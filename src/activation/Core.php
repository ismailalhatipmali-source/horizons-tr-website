<?php
declare(strict_types=1);

namespace Horizons;

const PRODUCT = 'horizons-arabic-level1';
const MAX_DEVICES = 3;
const PRICES_USD_CENTS = ['monthly' => 990, 'annual' => 9900, 'lifetime' => 15000];

interface Clock { public function now(): int; }
final class SystemClock implements Clock { public function now(): int { return time(); } }
function utc(int $timestamp): string { return gmdate('Y-m-d\TH:i:s\Z', $timestamp); }
function timestamp(string $value): int {
    $date = \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $value, new \DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d\TH:i:s\Z') !== $value) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
    return $date->getTimestamp();
}
function calendarMonths(int $start, int $months): int {
    $date = (new \DateTimeImmutable('@' . $start))->setTimezone(new \DateTimeZone('UTC'));
    $target = $date->modify('first day of this month')->modify('+' . $months . ' months');
    return $target->setDate((int)$target->format('Y'), (int)$target->format('n'), min((int)$date->format('j'), (int)$target->format('t')))->getTimestamp();
}

final class ServiceError extends \RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $httpStatus = 400) { parent::__construct($reason); }
}

function email(string $value): string {
    $value = strtolower(trim($value));
    if (strlen($value) > 254 || !filter_var($value, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $value)) throw new ServiceError('INVALID_REQUEST');
    return $value; // Do not merge plus aliases, remove dots, or substitute Gumroad account email.
}

function encoded(array $value): string {
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function decode64(string $value, int $length = 0): string {
    $raw = base64_decode($value, true);
    if ($raw === false || base64_encode($raw) !== $value || ($length && strlen($raw) !== $length)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    return $raw;
}

final class Crypto {
    public readonly string $dataKey;
    private readonly string $signingKey;
    private readonly string $contentKey;

    public function __construct(array $config) {
        $this->dataKey = decode64($config['data_key'] ?? '', 32);
        $vault = json_decode((string)file_get_contents($config['vault_path']), true, 8, JSON_THROW_ON_ERROR);
        if (($vault['schema'] ?? 0) !== 1 || ($vault['product'] ?? '') !== PRODUCT) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $this->signingKey = decode64($vault['signing_private_key'] ?? '', 64);
        $this->contentKey = decode64($vault['content_key'] ?? '', 32);
        // Reject a malformed Ed25519 secret/public pair, rather than emitting unverifiable licenses.
        $pair = sodium_crypto_sign_seed_keypair(substr($this->signingKey, 0, 32));
        if (!hash_equals(sodium_crypto_sign_secretkey($pair), $this->signingKey)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }

    public function keyed(string $domain, string $value): string { return hash_hmac('sha256', $domain . "\0" . $value, $this->dataKey); }
    public function seal(string $value): string {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return base64_encode($nonce . sodium_crypto_secretbox($value, $nonce, $this->dataKey));
    }
    public function open(string $value): string {
        $raw = decode64($value);
        if (strlen($raw) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $plain = sodium_crypto_secretbox_open(substr($raw, 24), substr($raw, 0, 24), $this->dataKey);
        if ($plain === false) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        return $plain;
    }

    public static function publicKey(string $encoded): array {
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) > 2048 || base64_encode($raw) !== $encoded) throw new ServiceError('INVALID_REQUEST');
        $key = openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split($encoded, 64, "\n") . "-----END PUBLIC KEY-----\n");
        if ($key === false) throw new ServiceError('INVALID_REQUEST');
        $details = openssl_pkey_get_details($key);
        if (!$details || $details['type'] !== OPENSSL_KEYTYPE_RSA || $details['bits'] < 2048 || $details['bits'] > 4096 || ($details['rsa']['e'] ?? '') !== "\x01\x00\x01") throw new ServiceError('INVALID_REQUEST');
        $canonical = preg_replace('/-----[^-]+-----|\s/', '', $details['key']);
        if ($canonical !== $encoded) throw new ServiceError('INVALID_REQUEST');
        return [$key, $raw, (int)ceil($details['bits'] / 8)];
    }

    private static function mgf1(string $seed, int $length): string {
        $out = '';
        for ($i = 0; strlen($out) < $length; $i++) $out .= hash('sha256', $seed . pack('N', $i), true);
        return substr($out, 0, $length);
    }

    public function license(array $entitlement, string $device, string $publicKey, string $purchaseEmail, int $now): array {
        [$key, $der, $k] = self::publicKey($publicKey);
        // EME-OAEP from RFC 8017 section 7.1.1. PHP 8.2's OAEP default is SHA-1;
        // encode SHA-256 explicitly, then perform the RSA operation without padding.
        $h = 32;
        $db = hash('sha256', PRODUCT, true) . str_repeat("\0", $k - strlen($this->contentKey) - 2 * $h - 2) . "\x01" . $this->contentKey;
        $seed = random_bytes($h);
        $maskedDB = $db ^ self::mgf1($seed, $k - $h - 1);
        $maskedSeed = $seed ^ self::mgf1($maskedDB, $h);
        if (!openssl_public_encrypt("\0" . $maskedSeed . $maskedDB, $wrapped, $key, OPENSSL_NO_PADDING)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $payload = encoded([
            'schema' => 3, 'product' => PRODUCT, 'license_id' => $entitlement['id'],
            'device_id' => $device, 'public_key_sha256' => hash('sha256', $der),
            'wrapped_key' => base64_encode($wrapped), 'max_devices' => (int)$entitlement['max_devices'],
            'issued_at' => utc($now), 'purchase_email' => $purchaseEmail,
            'account_id' => $entitlement['account_id'], 'plan' => $entitlement['plan'], 'channel' => $entitlement['channel'],
            'starts_at' => utc((int)$entitlement['starts_at']),
            'expires_at' => $entitlement['expires_at'] === null ? null : utc((int)$entitlement['expires_at']),
        ]);
        return ['payload' => base64_encode($payload), 'signature' => base64_encode(sodium_crypto_sign_detached($payload, $this->signingKey))];
    }
}

interface Purchases {
    /** Return normalized AUTHENTICATED sale terms; see PAID_ADAPTER_CONTRACT.md. Never accept browser proof. */
    public function find(string $purchaseEmail): ?array;
    public function byId(string $saleId): ?array;
}

interface Mailer { public function code(string $email, string $code, string $locale): void; }

/** Add optional adult account passwords without breaking v3 code rollback. */
final class Store {
    public readonly \PDO $db;
    private bool $transaction = false;
    public function __construct(string $path, private readonly Clock $clock = new SystemClock) {
        if (!is_dir(dirname($path)) || is_link($path)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        self::preflight($path);
        $this->db = new \PDO('sqlite:' . $path, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        @chmod($path, 0600);
        $this->db->exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
        $this->begin();
        try {
            $oldVersion = (int)$this->db->query('PRAGMA user_version')->fetchColumn();
            if ($oldVersion > 3) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
            $this->db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS challenges (
 id TEXT PRIMARY KEY, email_hash TEXT NOT NULL, email_cipher TEXT NOT NULL,
 device TEXT NOT NULL, key_hash TEXT NOT NULL, code_hash TEXT NOT NULL,
 expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS challenges_expiry ON challenges(expires);
CREATE TABLE IF NOT EXISTS entitlements (
 id TEXT PRIMARY KEY, sale_id TEXT NOT NULL UNIQUE, email_hash TEXT NOT NULL,
 email_cipher TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS entitlements_email ON entitlements(email_hash);
CREATE TABLE IF NOT EXISTS devices (
 entitlement_id TEXT NOT NULL REFERENCES entitlements(id), device TEXT NOT NULL,
 key_hash TEXT NOT NULL, registered_at INTEGER NOT NULL, recovered_at INTEGER NOT NULL,
 PRIMARY KEY(entitlement_id, device)
);
CREATE TABLE IF NOT EXISTS rates (bucket TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(bucket,window));
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_devices (
 account_id TEXT NOT NULL REFERENCES accounts(id), device TEXT NOT NULL, key_hash TEXT NOT NULL,
 registered_at INTEGER NOT NULL, recovered_at INTEGER NOT NULL, PRIMARY KEY(account_id,device)
);
CREATE TABLE IF NOT EXISTS invitations (
 token_hash TEXT PRIMARY KEY, entitlement_id TEXT NOT NULL REFERENCES entitlements(id), email_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires INTEGER NOT NULL, used_at INTEGER, used_device TEXT
);
CREATE TABLE IF NOT EXISTS webhook_events (event_hash TEXT PRIMARY KEY, sale_hash TEXT NOT NULL, checked_at INTEGER NOT NULL);
SQL);
            $this->column('challenges', 'invitation_hash', 'TEXT');
            foreach (['account_id'=>'TEXT', 'plan'=>'TEXT', 'channel'=>'TEXT', 'starts_at'=>'INTEGER', 'expires_at'=>'INTEGER', 'max_devices'=>'INTEGER', 'source'=>'TEXT'] as $name=>$type) $this->column('entitlements', $name, $type);
            $this->column('accounts', 'password_hash', 'TEXT');
            $this->column('accounts', 'password_version', 'INTEGER NOT NULL DEFAULT 0');
            // A pre-v3 entitlement was issued only after verified one-time Gumroad purchase.
            if ($oldVersion < 3) {
            $this->query("INSERT OR IGNORE INTO accounts(id,email_hash,created_at) SELECT 'acct_' || email_hash,email_hash,MIN(checked_at) FROM entitlements GROUP BY email_hash");
            $this->query("UPDATE entitlements SET account_id='acct_' || email_hash,plan='lifetime',channel='direct',starts_at=checked_at,expires_at=NULL,max_devices=3,source='legacy_v2' WHERE plan IS NULL");
            $this->query("INSERT OR IGNORE INTO account_devices(account_id,device,key_hash,registered_at,recovered_at) SELECT e.account_id,d.device,d.key_hash,d.registered_at,d.recovered_at FROM devices d JOIN entitlements e ON e.id=d.entitlement_id WHERE e.channel='direct' ORDER BY d.recovered_at DESC");
            }
            // Additive columns remain at v3 so the previous issuer can be restored.
            $this->db->exec('PRAGMA user_version=3');
            $this->commit();
        } catch (\Throwable $e) { $this->rollback(); throw $e; }
    }
    /** Aggregate-only preflight: never mutates or prints account/email identifiers. */
    public static function preflight(string $path): array {
        if (!is_file($path)) return ['database_exists'=>false,'schema_version'=>null,'migration_required'=>false,'accounts_over_limit'=>0];
        if (is_link($path)) throw new ServiceError('SERVICE_UNAVAILABLE',503);
        $db=new \PDO('sqlite:'.$path,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
        $db->exec('PRAGMA query_only=ON; PRAGMA busy_timeout=10000');
        $version=(int)$db->query('PRAGMA user_version')->fetchColumn();
        $tables=$db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(\PDO::FETCH_COLUMN);
        if ($version>3 || (count($tables)>0 && !in_array('entitlements',$tables,true))) throw new ServiceError('SERVICE_UNAVAILABLE',503);
        if (!in_array('entitlements',$tables,true)) return ['database_exists'=>true,'schema_version'=>$version,'migration_required'=>false,'accounts_over_limit'=>0];
        $fields=array_column($db->query('PRAGMA table_info(entitlements)')->fetchAll(\PDO::FETCH_ASSOC),'name');
        foreach (['id','sale_id','email_hash','email_cipher','revoked','checked_at'] as $field) if (!in_array($field,$fields,true)) throw new ServiceError('SERVICE_UNAVAILABLE',503);
        $sql=$version===3 ? 'SELECT COUNT(*) FROM (SELECT account_id FROM account_devices GROUP BY account_id HAVING COUNT(*)>3)' : 'SELECT COUNT(*) FROM (SELECT e.email_hash FROM entitlements e JOIN devices d ON d.entitlement_id=e.id GROUP BY e.email_hash HAVING COUNT(DISTINCT d.device)>3)';
        return ['database_exists'=>true,'schema_version'=>$version,'migration_required'=>$version<3,'entitlement_count'=>(int)$db->query('SELECT COUNT(*) FROM entitlements')->fetchColumn(),'accounts_over_limit'=>(int)$db->query($sql)->fetchColumn()];
    }
    private function column(string $table, string $column, string $type): void {
        foreach ($this->db->query('PRAGMA table_info(' . $table . ')')->fetchAll(\PDO::FETCH_ASSOC) as $row) if ($row['name'] === $column) return;
        $this->db->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $type);
    }
    public function query(string $sql, array $args = []): \PDOStatement { $s = $this->db->prepare($sql); $s->execute($args); return $s; }
    public function begin(): void { $this->db->exec('BEGIN IMMEDIATE'); $this->transaction = true; }
    public function commit(): void { $this->db->exec('COMMIT'); $this->transaction = false; }
    public function rollback(): void { if ($this->transaction) { $this->db->exec('ROLLBACK'); $this->transaction = false; } }
    public function throttle(string $bucket, int $windowSeconds, int $max): bool {
        $window = intdiv($this->clock->now(), $windowSeconds) * $windowSeconds;
        $this->query('INSERT INTO rates(bucket,window,count) VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET count=count+1', [$bucket, $window]);
        return (int)$this->query('SELECT count FROM rates WHERE bucket=? AND window=?', [$bucket, $window])->fetchColumn() <= $max;
    }
    public function account(string $hash, int $now): string {
        $id = 'acct_' . $hash;
        $this->query('INSERT OR IGNORE INTO accounts(id,email_hash,created_at) VALUES(?,?,?)', [$id, $hash, $now]);
        return $id;
    }
}

/** Owner-local issuance only: no public HTTP route, no email side effect. */
final class OwnerInvitations {
    /** A positive cap turns owner grants into a controlled free pilot. */
    public function __construct(private readonly Store $store, private readonly Crypto $crypto, private readonly Clock $clock = new SystemClock, private readonly int $pilotMaxGrants = 0) {}
    public function create(string $recipient, string $plan, int $validSeconds = 604800): array {
        if (!in_array($plan, ['trial_7d','evaluation_3m'], true) || $validSeconds < 60 || $validSeconds > 2592000) throw new ServiceError('INVALID_REQUEST');
        if ($this->pilotMaxGrants < 0 || $this->pilotMaxGrants > 100000) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $email = email($recipient); $hash = $this->crypto->keyed('email', $email); $now = $this->clock->now();
        $token = bin2hex(random_bytes(32));
        $this->store->begin();
        try {
            if ($this->pilotMaxGrants > 0) {
                $issued = (int)$this->store->query("SELECT COUNT(*) FROM entitlements WHERE channel='owner' AND source IN ('owner_invitation','auto_trial')")->fetchColumn();
                if ($issued >= $this->pilotMaxGrants) throw new ServiceError('PILOT_LIMIT_REACHED', 403);
            }
            $account = $this->store->account($hash, $now);
            $id = 'owner_' . $this->crypto->keyed('owner-entitlement', $account . ':' . $plan);
            $old = $this->store->query('SELECT * FROM entitlements WHERE id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
            if ($old && ((int)$old['revoked'] || ($old['expires_at'] !== null && (int)$old['expires_at'] <= $now))) throw new ServiceError('ENTITLEMENT_EXPIRED', 403);
            $this->store->query("INSERT OR IGNORE INTO entitlements(id,sale_id,email_hash,email_cipher,revoked,checked_at,account_id,plan,channel,starts_at,expires_at,max_devices,source) VALUES(?,?,?,?,0,?,?,?,'owner',NULL,NULL,1,'owner_invitation')", [$id, $id, $hash, $this->crypto->seal($email), $now, $account, $plan]);
            $this->store->query('INSERT INTO invitations(token_hash,entitlement_id,email_hash,created_at,expires) VALUES(?,?,?,?,?)', [$this->crypto->keyed('invitation', $token), $id, $hash, $now, $now + $validSeconds]);
            $this->store->commit();
            return ['product'=>PRODUCT, 'email'=>$email, 'plan'=>$plan, 'invitation_token'=>$token, 'invitation_expires_at'=>utc($now+$validSeconds), 'license_starts_on_first_activation'=>!$old || $old['starts_at'] === null];
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
    }
}

final class Service {
    /**
     * The automatic trial is deliberately opt-in.  When enabled, a verified
     * email address receives the same owner-channel trial that the private
     * invitation flow uses: one device, seven days from first activation.
     * The grant is created only after OTP verification and is capped by the
     * configured pilot limit.  No payment or browser-supplied entitlement is
     * accepted here.
     */
    public function __construct(
        private readonly Store $store,
        private readonly Crypto $crypto,
        private readonly Purchases $purchases,
        private readonly Mailer $mailer,
        private readonly Clock $clock = new SystemClock,
        private readonly bool $autoTrialEnabled = false,
        private readonly int $pilotMaxGrants = 0,
    ) {
        if ($this->pilotMaxGrants < 0 || $this->pilotMaxGrants > 100000) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    private function identity(array $input): array {
        $device = $input['device_id'] ?? ''; $pub = $input['public_key'] ?? '';
        if (!is_string($device) || !preg_match('/^[a-f0-9]{64}$/D', $device) || !is_string($pub)) throw new ServiceError('INVALID_REQUEST');
        [, $der] = Crypto::publicKey($pub);
        return [$device, $pub, hash('sha256', $der)];
    }
    private function validNewPassword(mixed $password): string {
        if (!is_string($password) || strlen($password) > 256 || preg_match('//u', $password) !== 1 || preg_match('/[\x00-\x1F\x7F]/u', $password) || preg_match_all('/./us', $password) < 12) throw new ServiceError('PASSWORD_WEAK');
        return $password;
    }
    private function passwordDigest(string $password): string {
        // A domain-separated server-side pepper also keeps bcrypt's input below 72 bytes.
        return hash_hmac('sha256', "account-password-v1\0" . $password, $this->crypto->dataKey);
    }
    private function hashPassword(string $password): string {
        return password_hash($this->passwordDigest($password), PASSWORD_BCRYPT, ['cost'=>12]);
    }
    private function savePassword(array $entitlement, string $hash): void {
        $updated=$this->store->query('UPDATE accounts SET password_hash=?,password_version=password_version+1 WHERE id=? AND email_hash=?', [$hash,$entitlement['account_id'],$entitlement['email_hash']]);
        if ($updated->rowCount() !== 1) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    private function assertPasswordVersion(array $entitlement, int $version): void {
        $row=$this->store->query('SELECT password_version,password_hash FROM accounts WHERE id=? AND email_hash=?', [$entitlement['account_id'],$entitlement['email_hash']])->fetch(\PDO::FETCH_ASSOC);
        if (!$row || !is_string($row['password_hash']) || (int)$row['password_version'] !== $version) throw new ServiceError('PASSWORD_INVALID', 403);
    }
    public function request(array $input, string $ip): array {
        [$device, , $keyHash] = $this->identity($input);
        if (!is_string($input['email'] ?? null)) throw new ServiceError('INVALID_REQUEST');
        $email = email($input['email']); $emailHash = $this->crypto->keyed('email', $email);
        $invitation = $input['invitation_token'] ?? null;
        if ($invitation === '') $invitation = null;
        if ($invitation !== null && (!is_string($invitation) || !preg_match('/^[a-f0-9]{64}$/D', $invitation))) throw new ServiceError('INVITATION_INVALID');
        $id = bin2hex(random_bytes(24));
        $response = ['ok' => true, 'challenge_id' => $id, 'expires_in' => 600];
        $ipOK = $this->store->throttle($this->crypto->keyed('request-ip', $ip), 3600, 20);
        $emailOK = $this->store->throttle($emailHash, 3600, 5);
        if (!$ipOK || !$emailOK) return $response;
        $code = str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $this->store->query('INSERT INTO challenges(id,email_hash,email_cipher,device,key_hash,code_hash,expires,invitation_hash) VALUES(?,?,?,?,?,?,?,?)',
            [$id, $emailHash, $this->crypto->seal($email), $device, $keyHash, $this->crypto->keyed('otp', $id . ':' . $code), $this->clock->now() + 600, $invitation === null ? null : $this->crypto->keyed('invitation', $invitation)]);
        $locale = is_string($input['locale'] ?? null) ? substr($input['locale'], 0, 12) : 'en';
        try { $this->mailer->code($email, $code, $locale); }
        catch (\Throwable $e) { $this->store->query('DELETE FROM challenges WHERE id=?', [$id]); throw new ServiceError('SERVICE_UNAVAILABLE', 503); }
        return $response;
    }
    public function verify(array $input, string $ip): array {
        [$device, $pub, $keyHash] = $this->identity($input);
        $id = $input['challenge_id'] ?? ''; $code = $input['code'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-f0-9]{48}$/D', $id) || !is_string($code) || !preg_match('/^[0-9]{8}$/D', $code)) throw new ServiceError('OTP_INVALID');
        $newPassword=array_key_exists('new_password',$input) ? $this->validNewPassword($input['new_password']) : null;
        if (!$this->store->throttle($this->crypto->keyed('verify-ip', $ip), 3600, 60)) throw new ServiceError('OTP_INVALID', 429);
        $this->store->begin();
        try {
            $row = $this->store->query('SELECT * FROM challenges WHERE id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
            if (!$row || (int)$row['used'] || (int)$row['expires'] <= $this->clock->now() || (int)$row['attempts'] >= 5) { $this->store->commit(); throw new ServiceError('OTP_INVALID'); }
            $this->store->query('UPDATE challenges SET attempts=attempts+1 WHERE id=?', [$id]);
            $valid = hash_equals($row['code_hash'], $this->crypto->keyed('otp', $id . ':' . $code)) && hash_equals($row['device'], $device) && hash_equals($row['key_hash'], $keyHash);
            if (!$valid) { $this->store->commit(); throw new ServiceError('OTP_INVALID'); }
            $this->store->query('UPDATE challenges SET used=1 WHERE id=?', [$id]);
            $this->store->commit();
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
        $email = $this->crypto->open($row['email_cipher']);
        $newHash=$newPassword === null ? null : $this->hashPassword($newPassword);
        // Owner activation/recovery works without a configured commercial adapter.
        if ($row['invitation_hash'] !== null) return $this->issueOwner($row, $email, $device, $pub, $keyHash, null, null, $newHash);
        $owner = $this->store->query("SELECT id FROM entitlements WHERE email_hash=? AND channel='owner' AND starts_at IS NOT NULL AND revoked=0 AND expires_at>? ORDER BY expires_at DESC LIMIT 1", [$row['email_hash'], $this->clock->now()])->fetchColumn();
        $knownPaid = $this->store->query("SELECT 1 FROM entitlements WHERE email_hash=? AND channel='direct' AND revoked=0 AND (expires_at IS NULL OR expires_at>?) LIMIT 1", [$row['email_hash'],$this->clock->now()])->fetchColumn();
        try { $sale = $this->purchases->find($email); }
        catch (ServiceError $e) {
            // An unrelated commercial outage must not prevent an active owner grant recovery.
            if ($knownPaid || $e->reason !== 'SERVICE_UNAVAILABLE' || (!$owner && !$this->autoTrialEnabled)) throw $e;
            $sale = null;
        }
        if (!$sale && $owner && !$knownPaid) return $this->issueOwner($row, $email, $device, $pub, $keyHash, (string)$owner, null, $newHash);
        // The first free-pilot activation is automatic: proving control of the
        // email by OTP is the only user-facing step.  This branch is reached
        // only when no paid right or active owner grant exists, and the
        // transactional method below makes the one-device/one-email grant
        // race-safe.  An already started expired owner grant is still handled
        // by the existing ENTITLEMENT_EXPIRED branch below.
        if (!$sale && !$owner && $this->autoTrialEnabled) return $this->issueAutoTrial($row, $email, $device, $pub, $keyHash, $newHash);
        if (!$sale) {
            if ($this->store->query("SELECT 1 FROM entitlements WHERE email_hash=? AND channel='owner' AND starts_at IS NOT NULL", [$row['email_hash']])->fetchColumn()) throw new ServiceError('ENTITLEMENT_EXPIRED', 403);
            throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        }
        if (!is_string($sale['email'] ?? null) || !hash_equals($email, $sale['email'])) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        return $this->issuePaid($sale, $device, $pub, $keyHash, null, $newHash);
    }
    /** Password login is only a second way to ask the original issuer for a device licence. */
    public function passwordLogin(array $input, string $ip): array {
        [$device,$pub,$keyHash]=$this->identity($input);
        $address=$input['email']??null;
        $password=$input['password']??null;
        if (!is_string($address) || !is_string($password) || strlen($password)>256 || strlen($password)<12 || str_contains($password,"\0")) throw new ServiceError('PASSWORD_INVALID',403);
        $address=email($address);$emailHash=$this->crypto->keyed('email',$address);
        $ipAllowed=$this->store->throttle($this->crypto->keyed('password-ip',$ip),3600,60);
        $emailAllowed=$this->store->throttle($this->crypto->keyed('password-email',$address),3600,8);
        if (!$ipAllowed || !$emailAllowed) throw new ServiceError('PASSWORD_INVALID',429);
        $account=$this->store->query('SELECT id,password_hash,password_version FROM accounts WHERE email_hash=?',[$emailHash])->fetch(\PDO::FETCH_ASSOC);
        // A fixed-cost dummy hash keeps unknown addresses on the verification path.
        $dummy='$2y$12$4Umg0rCJwMswRw/l.SwHvuQV01coP0eWmGzd61QH2RvAOMANUBGC.';
        $valid=password_verify($this->passwordDigest($password),is_string($account['password_hash']??null)?$account['password_hash']:$dummy);
        if (!$account || !$valid || !is_string($account['password_hash'])) throw new ServiceError('PASSWORD_INVALID',403);
        $version=(int)$account['password_version'];$now=$this->clock->now();
        $owner=$this->store->query("SELECT id FROM entitlements WHERE email_hash=? AND channel='owner' AND starts_at IS NOT NULL AND revoked=0 AND expires_at>? ORDER BY expires_at DESC LIMIT 1",[$emailHash,$now])->fetchColumn();
        $knownPaid=$this->store->query("SELECT 1 FROM entitlements WHERE email_hash=? AND channel='direct' AND revoked=0 AND (expires_at IS NULL OR expires_at>?) LIMIT 1",[$emailHash,$now])->fetchColumn();
        try {$sale=$this->purchases->find($address);}
        catch (ServiceError $e) {
            if ($knownPaid || $e->reason!=='SERVICE_UNAVAILABLE' || !$owner) throw $e;
            $sale=null;
        }
        if ($sale) {
            if (!is_string($sale['email']??null) || !hash_equals($address,$sale['email'])) throw new ServiceError('PURCHASE_UNAVAILABLE',403);
            return $this->issuePaid($sale,$device,$pub,$keyHash,$version);
        }
        if ($owner && !$knownPaid) return $this->issueOwner(['email_hash'=>$emailHash,'invitation_hash'=>null],$address,$device,$pub,$keyHash,(string)$owner,$version);
        throw new ServiceError('ENTITLEMENT_EXPIRED',403);
    }
    /** Only called on server-side adapter output, never HTTP request payment fields. */
    private function paid(array $sale, ?array $existing = null): array {
        if (!is_string($sale['sale_id'] ?? null) || !preg_match('/^[A-Za-z0-9_+=\/-]{1,120}$/D', $sale['sale_id']) || !is_string($sale['email'] ?? null)) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        $sale['email'] = email($sale['email']);
        $plan = $sale['plan'] ?? null;
        // Minimal old adapter records are accepted only for already migrated purchases.
        if ($plan === null && $existing && $existing['source'] === 'legacy_v2') return ['plan'=>'lifetime','starts_at'=>(int)$existing['starts_at'],'expires_at'=>null,'source'=>'legacy_v2'];
        if (!in_array($plan, ['monthly','annual','lifetime'], true) || ($sale['verified'] ?? false) !== true || ($sale['product'] ?? null) !== PRODUCT || ($sale['channel'] ?? null) !== 'direct' || !is_string($sale['starts_at'] ?? null)) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        $start = timestamp($sale['starts_at']);
        $expiry = $sale['expires_at'] ?? null;
        if ($plan === 'lifetime') {
            if ($expiry !== null) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        } else {
            if (!is_string($expiry)) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
            $expiry = timestamp($expiry);
            if ($expiry <= $start) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        }
        // One-time sales verified by the original adapter retain their original price/rights.
        $legacy = ($sale['legacy_one_time'] ?? false) === true && $plan === 'lifetime';
        if (!$legacy && (($sale['currency'] ?? null) !== 'USD' || ($sale['amount_cents'] ?? null) !== PRICES_USD_CENTS[$plan])) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        return ['plan'=>$plan,'starts_at'=>$start,'expires_at'=>$expiry,'source'=>$legacy ? 'verified_one_time' : 'verified_adapter'];
    }
    private function savePaid(array $sale, int $now): array {
        $existing = $this->store->query('SELECT * FROM entitlements WHERE sale_id=?', [$sale['sale_id'] ?? ''])->fetch(\PDO::FETCH_ASSOC) ?: null;
        $terms = $this->paid($sale, $existing); $hash = $this->crypto->keyed('email', $sale['email']);
        if ($existing && !hash_equals($existing['email_hash'], $hash)) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        // A purchased lifetime right cannot be downgraded by a later adapter classification.
        if ($existing && $existing['plan'] === 'lifetime' && $terms['plan'] !== 'lifetime') throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        $account = $this->store->account($hash, $now); $id = $existing['id'] ?? 'gr_' . hash('sha256', $sale['sale_id']);
        $this->store->query("INSERT INTO entitlements(id,sale_id,email_hash,email_cipher,revoked,checked_at,account_id,plan,channel,starts_at,expires_at,max_devices,source) VALUES(?,?,?,?,0,?,?,?,'direct',?,?,3,?) ON CONFLICT(sale_id) DO UPDATE SET revoked=0,checked_at=excluded.checked_at,plan=excluded.plan,starts_at=excluded.starts_at,expires_at=excluded.expires_at,source=excluded.source", [$id,$sale['sale_id'],$hash,$this->crypto->seal($sale['email']),$now,$account,$terms['plan'],$terms['starts_at'],$terms['expires_at'],$terms['source']]);
        return $this->store->query('SELECT * FROM entitlements WHERE id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
    }
    private function issuePaid(array $sale, string $device, string $pub, string $keyHash, ?int $passwordVersion = null, ?string $newHash = null): array {
        $this->store->begin();
        try {
            $entitlement = $this->savePaid($sale, $this->clock->now());
            if ($passwordVersion !== null) $this->assertPasswordVersion($entitlement,$passwordVersion);
            $result = $this->allocate($entitlement, $sale['email'], $device, $pub, $keyHash, $passwordVersion !== null);
            if ($newHash !== null) $this->savePassword($entitlement,$newHash);
            $this->store->commit(); return $result;
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
    }
    private function issueOwner(array $challenge, string $email, string $device, string $pub, string $keyHash, ?string $recoveryId = null, ?int $passwordVersion = null, ?string $newHash = null): array {
        $this->store->begin();
        try {
            $now = $this->clock->now(); $invitation = null;
            if ($recoveryId === null) {
                $invitation = $this->store->query('SELECT * FROM invitations WHERE token_hash=?', [$challenge['invitation_hash']])->fetch(\PDO::FETCH_ASSOC);
                if (!$invitation || $invitation['used_at'] !== null || (int)$invitation['expires'] <= $now || !hash_equals($invitation['email_hash'], $challenge['email_hash'])) throw new ServiceError('INVITATION_INVALID', 403);
                $recoveryId = $invitation['entitlement_id'];
            }
            $entitlement = $this->store->query("SELECT * FROM entitlements WHERE id=? AND channel='owner' AND email_hash=?", [$recoveryId, $challenge['email_hash']])->fetch(\PDO::FETCH_ASSOC);
            if (!$entitlement || (int)$entitlement['revoked']) throw new ServiceError('ENTITLEMENT_EXPIRED', 403);
            if ($entitlement['starts_at'] === null) {
                if (!$invitation) throw new ServiceError('INVITATION_INVALID', 403);
                $expiry = $entitlement['plan'] === 'trial_7d' ? $now + 604800 : calendarMonths($now, 3);
                $this->store->query('UPDATE entitlements SET starts_at=?,expires_at=?,checked_at=? WHERE id=? AND starts_at IS NULL', [$now,$expiry,$now,$recoveryId]);
                $entitlement['starts_at']=$now; $entitlement['expires_at']=$expiry;
            }
            if ($passwordVersion !== null) $this->assertPasswordVersion($entitlement,$passwordVersion);
            $result = $this->allocate($entitlement, $email, $device, $pub, $keyHash, $passwordVersion !== null);
            if ($newHash !== null) $this->savePassword($entitlement,$newHash);
            if ($invitation) $this->store->query('UPDATE invitations SET used_at=?,used_device=? WHERE token_hash=? AND used_at IS NULL', [$now,$device,$challenge['invitation_hash']]);
            $this->store->commit(); return $result;
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
    }
    /**
     * Issue the controlled automatic free-pilot grant after a successful OTP.
     * This is intentionally separate from issueOwner(): no invitation row is
     * consumed and no network call occurs while the allocation lock is held.
     */
    private function issueAutoTrial(array $challenge, string $email, string $device, string $pub, string $keyHash, ?string $newHash = null): array {
        $this->store->begin();
        try {
            $now = $this->clock->now();
            $account = $this->store->account($challenge['email_hash'], $now);
            $id = 'owner_' . $this->crypto->keyed('owner-entitlement', $account . ':trial_7d');
            $entitlement = $this->store->query("SELECT * FROM entitlements WHERE id=? AND channel='owner' AND plan='trial_7d' AND email_hash=?", [$id, $challenge['email_hash']])->fetch(\PDO::FETCH_ASSOC);
            if (!$entitlement) {
                if ($this->pilotMaxGrants > 0) {
                    $issued = (int)$this->store->query("SELECT COUNT(*) FROM entitlements WHERE channel='owner' AND source IN ('owner_invitation','auto_trial')")->fetchColumn();
                    if ($issued >= $this->pilotMaxGrants) throw new ServiceError('PILOT_LIMIT_REACHED', 403);
                }
                $this->store->query("INSERT INTO entitlements(id,sale_id,email_hash,email_cipher,revoked,checked_at,account_id,plan,channel,starts_at,expires_at,max_devices,source) VALUES(?,?,?,?,0,?,?,?,'owner',NULL,NULL,1,'auto_trial')", [$id, $id, $challenge['email_hash'], $this->crypto->seal($email), $now, $account, 'trial_7d']);
                $entitlement = $this->store->query('SELECT * FROM entitlements WHERE id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
            }
            if (!$entitlement || (int)$entitlement['revoked']) throw new ServiceError('ENTITLEMENT_EXPIRED', 403);
            if ($entitlement['starts_at'] === null) {
                $expiry = $now + 604800;
                $this->store->query('UPDATE entitlements SET starts_at=?,expires_at=?,checked_at=? WHERE id=? AND starts_at IS NULL', [$now, $expiry, $now, $id]);
                $entitlement['starts_at'] = $now;
                $entitlement['expires_at'] = $expiry;
            }
            $result = $this->allocate($entitlement, $email, $device, $pub, $keyHash);
            if ($newHash !== null) $this->savePassword($entitlement,$newHash);
            $this->store->commit();
            return $result;
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
    }
    /** Called inside an IMMEDIATE transaction; no network occurs while allocating seats. */
    private function allocate(array $e, string $email, string $device, string $pub, string $keyHash, bool $passwordLogin = false): array {
        $now = $this->clock->now();
        if ((int)$e['revoked'] || (int)$e['starts_at'] > $now || ($e['expires_at'] !== null && $now >= (int)$e['expires_at'])) throw new ServiceError('ENTITLEMENT_EXPIRED', 403);
        if ($e['channel'] === 'direct') {
            $known = $this->store->query('SELECT key_hash FROM account_devices WHERE account_id=? AND device=?', [$e['account_id'],$device])->fetchColumn();
            $count = (int)$this->store->query('SELECT COUNT(*) FROM account_devices WHERE account_id=?', [$e['account_id']])->fetchColumn();
        } else {
            $known = $this->store->query('SELECT key_hash FROM devices WHERE entitlement_id=? AND device=?', [$e['id'],$device])->fetchColumn();
            $count = (int)$this->store->query('SELECT COUNT(*) FROM devices WHERE entitlement_id=?', [$e['id']])->fetchColumn();
        }
        if ($passwordLogin && is_string($known) && !hash_equals($known,$keyHash)) throw new ServiceError('DEVICE_ID_CONFLICT',409);
        if ($known === false && $count >= (int)$e['max_devices']) throw new ServiceError('DEVICE_LIMIT', 409);
        $envelope = $this->crypto->license($e, $device, $pub, $email, $now);
        $this->store->query('INSERT INTO devices(entitlement_id,device,key_hash,registered_at,recovered_at) VALUES(?,?,?,?,?) ON CONFLICT(entitlement_id,device) DO UPDATE SET key_hash=excluded.key_hash,recovered_at=excluded.recovered_at', [$e['id'],$device,$keyHash,$now,$now]);
        if ($e['channel'] === 'direct') $this->store->query('INSERT INTO account_devices(account_id,device,key_hash,registered_at,recovered_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,device) DO UPDATE SET key_hash=excluded.key_hash,recovered_at=excluded.recovered_at', [$e['account_id'],$device,$keyHash,$now,$now]);
        return ['ok'=>true,'license'=>$envelope];
    }
    public function synchronize(string $saleId, ?string $eventId = null): bool {
        if (!preg_match('/^[A-Za-z0-9_+=\/-]{1,120}$/D', $saleId) || ($eventId !== null && (!preg_match('/^[A-Za-z0-9_+=.\/-]{1,200}$/D', $eventId)))) throw new ServiceError('INVALID_REQUEST');
        // Always revalidate, including duplicate notifications. Never trust body status/periods.
        $sale = $this->purchases->byId($saleId);
        if ($sale !== null && ($sale['sale_id'] ?? null) !== $saleId) throw new ServiceError('PURCHASE_UNAVAILABLE', 403);
        $this->store->begin();
        try {
            $existing = $this->store->query('SELECT * FROM entitlements WHERE sale_id=?', [$saleId])->fetch(\PDO::FETCH_ASSOC);
            if ($eventId !== null) {
                $event = $this->store->query('SELECT sale_hash FROM webhook_events WHERE event_hash=?', [$this->crypto->keyed('webhook-event',$eventId)])->fetchColumn();
                if ($event && !hash_equals($event, $this->crypto->keyed('sale',$saleId))) throw new ServiceError('INVALID_REQUEST');
            }
            $eligible = $sale !== null;
            if (!$sale || ($existing && !hash_equals($existing['email_hash'], $this->crypto->keyed('email', $sale['email'])))) {
                $this->store->query('UPDATE entitlements SET revoked=1,checked_at=? WHERE sale_id=?', [$this->clock->now(),$saleId]); $eligible = false;
            } else $this->savePaid($sale, $this->clock->now());
            if ($eventId !== null) $this->store->query('INSERT INTO webhook_events(event_hash,sale_hash,checked_at) VALUES(?,?,?) ON CONFLICT(event_hash) DO UPDATE SET checked_at=excluded.checked_at', [$this->crypto->keyed('webhook-event',$eventId),$this->crypto->keyed('sale',$saleId),$this->clock->now()]);
            $this->store->commit(); return $eligible;
        } catch (\Throwable $e) { $this->store->rollback(); throw $e; }
    }
}
