<?php
declare(strict_types=1);
namespace Horizons;

/** Internal service component. No HTTP route or client authentication is provided here. */
final class ProgressError extends \RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $httpStatus = 400, public readonly array $details = []) { parent::__construct($reason); }
}

/** Construct ONLY from a verified server session, never from JSON account_id/email fields. */
final class VerifiedProgressAccount {
    public function __construct(public readonly string $id) {
        if (!preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D', $id)) throw new ProgressError('INVALID_ACCOUNT');
    }
}

/** Server-loaded, profile-specific eligibility and consent records; not a client assertion. */
final class ProgressConsent {
    public function __construct(
        public readonly VerifiedProgressAccount $owner,
        public readonly string $profileId,
        public readonly string $eligibility,
        public readonly bool $optedIn,
        public readonly string $receiptId,
    ) {}
    public function enforce(VerifiedProgressAccount $owner, string $profileId): void {
        if ($this->owner->id !== $owner->id || $this->profileId !== $profileId || $this->eligibility !== 'adult') throw new ProgressError('ELIGIBILITY_REVIEW_REQUIRED', 403);
        if (!$this->optedIn || !preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D', $this->receiptId)) throw new ProgressError('SYNC_CONSENT_REQUIRED', 403);
    }
}

final class ProgressStore {
    private \PDO $db;
    private \PDO $ledger;
    private \Closure $clock;
    private const LIMIT = 262144;
    private const DAY = 86400;

    /** $clock is trusted dependency injection for tests; never an HTTP parameter. */
    public function __construct(string $path, string $ledgerPath, private readonly string $key, ?callable $clock = null) {
        if (strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES || $path === $ledgerPath || !is_dir(dirname($path)) || !is_dir(dirname($ledgerPath)) || is_link($path) || is_link($ledgerPath)) throw new ProgressError('STORAGE_UNAVAILABLE', 503);
        if (file_exists($path) && !file_exists($ledgerPath)) throw new ProgressError('DELETION_LEDGER_MISSING', 503);
        $this->clock = $clock === null ? static fn(): int => time() : \Closure::fromCallable($clock);
        // The deletion ledger must survive independently of progress snapshots.
        $this->ledger = $this->open($ledgerPath);
        $this->db = $this->open($path);
        foreach ([$this->ledger,$this->db] as $database) {
            $database->exec('CREATE TABLE IF NOT EXISTS progress_metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
            $verifier = hash_hmac('sha256','horizons-progress-key-v1',$key);
            $this->query($database,'INSERT OR IGNORE INTO progress_metadata VALUES(?,?)',['key_verifier',$verifier]);
            $stored = $this->query($database,'SELECT value FROM progress_metadata WHERE name=?',['key_verifier'])->fetchColumn();
            if (!is_string($stored) || !hash_equals($stored,$verifier)) throw new ProgressError('STORAGE_KEY_MISMATCH',503);
        }
        $this->ledger->exec('CREATE TABLE IF NOT EXISTS deleted (account TEXT NOT NULL, profile TEXT NOT NULL, revision INTEGER NOT NULL, deleted_at INTEGER NOT NULL, backup_deadline INTEGER NOT NULL, reason TEXT NOT NULL, request_hash TEXT NOT NULL, erased_at INTEGER, erasure_evidence TEXT, PRIMARY KEY(account,profile));');
        $this->db->exec('CREATE TABLE IF NOT EXISTS profiles (account TEXT NOT NULL, profile TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, body_hash TEXT NOT NULL, learning_hash TEXT NOT NULL, activity INTEGER NOT NULL, consent TEXT NOT NULL, PRIMARY KEY(account,profile));
            CREATE TABLE IF NOT EXISTS requests (account TEXT NOT NULL, request TEXT NOT NULL, profile TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(account,request));
            CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, account TEXT NOT NULL, profile TEXT NOT NULL, due INTEGER NOT NULL, days INTEGER NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER, delivery_receipt TEXT, UNIQUE(account,profile,due,days));');
    }

    private function open(string $path): \PDO {
        $db = new \PDO('sqlite:' . $path, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC]);
        chmod($path, 0600);
        $db->exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA synchronous=FULL; PRAGMA busy_timeout=10000;');
        return $db;
    }
    private function query(\PDO $db, string $sql, array $args = []): \PDOStatement { $s = $db->prepare($sql); $s->execute($args); return $s; }
    private function transaction(callable $fn): mixed {
        $this->db->exec('BEGIN IMMEDIATE');
        try { $r = $fn(); $this->db->exec('COMMIT'); return $r; }
        catch (\Throwable $e) { $this->db->exec('ROLLBACK'); throw $e; }
    }
    private function now(): int { $n = ($this->clock)(); if (!is_int($n) || $n < 0) throw new ProgressError('INVALID_SERVER_CLOCK', 503); return $n; }
    private function account(VerifiedProgressAccount $account): string { return hash_hmac('sha256', "progress-account\0" . $account->id, $this->key); }
    /** INTERNAL owner registry adapter can resolve queue references without storing email here. */
    public function accountReference(VerifiedProgressAccount $account): string { return $this->account($account); }
    private function profile(string $id): void { if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new ProgressError('INVALID_PROFILE'); }
    private function request(string $id): void { if (!preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $id)) throw new ProgressError('INVALID_REQUEST_ID'); }
    private function json(mixed $v): string { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); }
    private function seal(string $v): string { $n = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES); return base64_encode($n . sodium_crypto_secretbox($v, $n, $this->key)); }
    private function unseal(string $v): array {
        $raw = base64_decode($v, true);
        if ($raw === false || strlen($raw) < 40) throw new ProgressError('STORAGE_UNAVAILABLE', 503);
        $plain = sodium_crypto_secretbox_open(substr($raw, 24), substr($raw, 0, 24), $this->key);
        if ($plain === false) throw new ProgressError('STORAGE_UNAVAILABLE', 503);
        return json_decode($plain, true, 16, JSON_THROW_ON_ERROR);
    }
    private function row(string $a, string $p): array|false { return $this->query($this->db, 'SELECT * FROM profiles WHERE account=? AND profile=?', [$a,$p])->fetch(); }
    private function tombstone(string $a, string $p): array|false { return $this->query($this->ledger, 'SELECT * FROM deleted WHERE account=? AND profile=?', [$a,$p])->fetch(); }
    private function alive(string $a, string $p): void { if ($t = $this->tombstone($a,$p)) throw new ProgressError('PROFILE_DELETED', 410, ['revision'=>(int)$t['revision']]); }
    private function cas(array|false $row, int $base): void {
        if ($base < 0 || ($row ? (int)$row['revision'] : 0) !== $base) throw new ProgressError('REVISION_CONFLICT', 409, ['current_revision'=>$row ? (int)$row['revision'] : 0]);
    }
    private function replay(string $a, string $request, string $fingerprint): ?array {
        $row = $this->query($this->db, 'SELECT * FROM requests WHERE account=? AND request=?', [$a,$request])->fetch();
        if (!$row) return null;
        if (!hash_equals($row['fingerprint'], $fingerprint)) throw new ProgressError('REQUEST_ID_REUSED', 409);
        return json_decode($row['response'], true, 8, JSON_THROW_ON_ERROR);
    }
    private function record(string $a, string $p, string $request, string $fingerprint, array $response): array {
        $this->query($this->db, 'INSERT INTO requests VALUES(?,?,?,?,?)', [$a,$request,$p,$fingerprint,$this->json($response)]); return $response;
    }
    private function fingerprint(string $op, string $p, int $base, mixed $body = null): string { return hash('sha256', $this->json([$op,$p,$base,$body])); }
    private function keys(array $v, array $keys): void { $actual = array_keys($v); sort($actual); sort($keys); if ($actual !== $keys) throw new ProgressError('INVALID_SCHEMA'); }
    private function canonical(array $v): array { ksort($v); foreach ($v as &$x) if (is_array($x)) $x = $this->canonical($x); return $v; }

    /** Minimal sync projection, not the full local workbook object or ink strokes. */
    private function document(array $v): array {
        try { $length = strlen($this->json($v)); }
        catch (\JsonException $e) { throw new ProgressError('INVALID_SCHEMA'); }
        if ($length > self::LIMIT) throw new ProgressError('PAYLOAD_TOO_LARGE', 413);
        $this->keys($v, ['schema','nickname','settings','progress']);
        if ($v['schema'] !== 1 || !is_string($v['nickname']) || preg_match('//u', $v['nickname']) !== 1 || preg_match('/[\x00-\x1F\x7F]/u', $v['nickname']) || preg_match_all('/./us', $v['nickname']) > 80 || !is_array($v['settings']) || !is_array($v['progress'])) throw new ProgressError('INVALID_SCHEMA');
        $this->keys($v['settings'], ['locale','font','font_scale']);
        if (!in_array($v['settings']['locale'], explode(' ', 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'), true) || !in_array($v['settings']['font'], ['noto-naskh','amiri','scheherazade','noto-sans','noto-kufi'], true) || !in_array($v['settings']['font_scale'], [90,100,115,130,145], true)) throw new ProgressError('INVALID_SCHEMA');
        $this->keys($v['progress'], ['heard','attempts','written']);
        foreach ($v['progress'] as $type => $map) {
            if (!is_array($map) || count($map) > ($type === 'written' ? 112 : 3000)) throw new ProgressError('INVALID_SCHEMA');
            foreach ($map as $id=>$value) {
                if (!is_string($id) || strlen($id) > 96) throw new ProgressError('INVALID_SCHEMA');
                if ($type === 'heard' && (!preg_match('/^(alphabet\.|word\.|sentence\.|story\.)[a-z0-9_-]+$/D',$id) || !is_bool($value))) throw new ProgressError('INVALID_SCHEMA');
                if ($type === 'written' && (!preg_match('/^(alif|baa|taa|thaa|jiim|haa|khaa|daal|dhaal|raa|zaay|siin|shiin|saad|daad|taa_emphatic|dhaa_emphatic|ayn|ghayn|faa|qaaf|kaaf|laam|miim|nuun|haa_breath|waaw|yaa):(isolated|initial|medial|final)$/D',$id) || !is_bool($value))) throw new ProgressError('INVALID_SCHEMA');
                if ($type === 'attempts') {
                    if (!preg_match('/^(alpha-|match-|word-|sentence-|story-)[a-z0-9_.-]+$/D',$id) || !is_array($value)) throw new ProgressError('INVALID_SCHEMA');
                    $this->keys($value,['completed','count']);
                    if (!is_bool($value['completed']) || !is_int($value['count']) || $value['count'] < 0 || $value['count'] >= 100000) throw new ProgressError('INVALID_SCHEMA');
                }
            }
        }
        return $this->canonical($v);
    }

    public function put(VerifiedProgressAccount $owner, ProgressConsent $consent, string $profile, string $request, int $baseRevision, array $document): array {
        $this->profile($profile); $consent->enforce($owner,$profile); $this->request($request); $doc = $this->document($document); $a = $this->account($owner);
        $fingerprint = $this->fingerprint('put',$profile,$baseRevision,$doc);
        return $this->transaction(function() use ($a,$profile,$request,$baseRevision,$doc,$consent,$fingerprint) {
            $this->alive($a,$profile);
            if ($r = $this->replay($a,$request,$fingerprint)) return $r;
            $row = $this->row($a,$profile); $this->cas($row,$baseRevision);
            $body = $this->json($doc); $hash = hash('sha256',$body); $learning = hash('sha256',$this->json($doc['progress']));
            // Settings/nickname changes and unchanged retries are not learning activity.
            $activity = !$row || !hash_equals($row['learning_hash'],$learning) ? $this->now() : (int)$row['activity'];
            $revision = $row && hash_equals($row['body_hash'],$hash) ? $baseRevision : $baseRevision + 1;
            if (!$row && (int)$this->query($this->db,'SELECT COUNT(*) FROM profiles WHERE account=?',[$a])->fetchColumn() >= 1000) throw new ProgressError('PROFILE_LIMIT',507);
            if ((int)$this->query($this->db,'SELECT COUNT(*) FROM requests WHERE account=? AND profile=?',[$a,$profile])->fetchColumn() >= 100000) throw new ProgressError('REQUEST_LOG_LIMIT',507);
            $this->query($this->db,'INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account,profile) DO UPDATE SET revision=excluded.revision,body=excluded.body,body_hash=excluded.body_hash,learning_hash=excluded.learning_hash,activity=excluded.activity,consent=excluded.consent',[$a,$profile,$revision,$this->seal($body),$hash,$learning,$activity,hash_hmac('sha256',$consent->receiptId,$this->key)]);
            if (!$row || $activity !== (int)$row['activity']) $this->query($this->db,'DELETE FROM reminders WHERE account=? AND profile=?',[$a,$profile]);
            return $this->record($a,$profile,$request,$fingerprint,['ok'=>true,'revision'=>$revision,'last_meaningful_activity'=>$activity,'delete_due_at'=>self::anniversary($activity)]);
        });
    }

    /** Read does not extend retention. Export remains possible after consent withdrawal. */
    public function export(VerifiedProgressAccount $owner, string $profile): array {
        $this->profile($profile); $a = $this->account($owner);
        return $this->transaction(function() use ($a,$profile) {
            $this->alive($a,$profile); $row = $this->row($a,$profile);
            if (!$row) throw new ProgressError('PROFILE_NOT_FOUND',404);
            return ['schema'=>1,'profile_id'=>$profile,'revision'=>(int)$row['revision'],'document'=>$this->unseal($row['body']),'last_meaningful_activity'=>(int)$row['activity'],'delete_due_at'=>self::anniversary((int)$row['activity'])];
        });
    }
    public function get(VerifiedProgressAccount $owner, ProgressConsent $consent, string $profile): array { $consent->enforce($owner,$profile); return $this->export($owner,$profile); }

    /** Explicit retain requires a fresh user action; adapters must not call on heartbeat/update. */
    public function retain(VerifiedProgressAccount $owner, ProgressConsent $consent, string $profile, string $request, int $baseRevision): array {
        $this->profile($profile); $consent->enforce($owner,$profile); $this->request($request); $a = $this->account($owner); $fp = $this->fingerprint('retain',$profile,$baseRevision);
        return $this->transaction(function() use ($a,$profile,$request,$baseRevision,$fp) {
            $this->alive($a,$profile); if ($r = $this->replay($a,$request,$fp)) return $r;
            $row = $this->row($a,$profile); if (!$row) throw new ProgressError('PROFILE_NOT_FOUND',404); $this->cas($row,$baseRevision);
            $n=$this->now(); $this->query($this->db,'UPDATE profiles SET activity=?,revision=revision+1 WHERE account=? AND profile=?',[$n,$a,$profile]);
            $this->query($this->db,'DELETE FROM reminders WHERE account=? AND profile=?',[$a,$profile]);
            return $this->record($a,$profile,$request,$fp,['ok'=>true,'revision'=>$baseRevision+1,'last_meaningful_activity'=>$n,'delete_due_at'=>self::anniversary($n)]);
        });
    }

    /** Cloud-only deletion, including early requests; no license or local learner files touched. */
    public function delete(VerifiedProgressAccount $owner, string $profile, string $request, int $baseRevision): array {
        $this->profile($profile); $this->request($request); $a=$this->account($owner);
        return $this->transaction(function() use ($a,$profile,$request,$baseRevision) {
            if ($t=$this->tombstone($a,$profile)) return $this->deletionResponse($t);
            // A delete cannot reuse an unrelated still-live mutation request ID.
            $this->replay($a,$request,$this->fingerprint('delete',$profile,$baseRevision));
            $row=$this->row($a,$profile); $this->cas($row,$baseRevision);
            return $this->erase($a,$profile,$baseRevision+1,'owner_request',$request);
        });
    }
    private function deletionResponse(array $t): array { return ['ok'=>true,'deleted'=>true,'revision'=>(int)$t['revision'],'deleted_at'=>(int)$t['deleted_at'],'backup_erasure_deadline'=>(int)$t['backup_deadline']]; }
    private function erase(string $a,string $p,int $revision,string $reason,string $request): array {
        $n=$this->now();
        // Commit suppression FIRST. A crash before the primary delete still cannot re-expose data.
        $this->query($this->ledger,'INSERT OR IGNORE INTO deleted(account,profile,revision,deleted_at,backup_deadline,reason,request_hash) VALUES(?,?,?,?,?,?,?)',[$a,$p,$revision,$n,$n+30*self::DAY,$reason,hash('sha256',$request)]);
        $this->query($this->db,'DELETE FROM profiles WHERE account=? AND profile=?',[$a,$p]);
        $this->query($this->db,'DELETE FROM requests WHERE account=? AND profile=?',[$a,$p]);
        $this->query($this->db,'DELETE FROM reminders WHERE account=? AND profile=?',[$a,$p]);
        return $this->deletionResponse($this->tombstone($a,$p));
    }

    /** UTC calendar anniversary; Feb 29 clamps to Feb 28, never +365 days or PHP March rollover. */
    public static function anniversary(int $timestamp): int {
        $d=(new \DateTimeImmutable('@'.$timestamp))->setTimezone(new \DateTimeZone('UTC'));
        $year=(int)$d->format('Y')+1; $month=(int)$d->format('n');
        $last=(int)$d->setDate($year,$month,1)->modify('last day of this month')->format('j');
        return $d->setDate($year,$month,min((int)$d->format('j'),$last))->getTimestamp();
    }

    /** INTERNAL scheduler. Queue contains references only and sends absolutely no messages. */
    public function retentionReview(): array {
        return $this->transaction(function() {
            $n=$this->now(); $result=[];
            foreach ($this->query($this->db,'SELECT * FROM profiles')->fetchAll() as $row) {
                if ($this->tombstone($row['account'],$row['profile'])) continue;
                $due=self::anniversary((int)$row['activity']);
                foreach ([30,7] as $days) if ($n >= $due-$days*self::DAY) {
                    $id=hash_hmac('sha256',implode(':',[$row['account'],$row['profile'],$due,$days]),$this->key);
                    $this->query($this->db,'INSERT OR IGNORE INTO reminders(id,account,profile,due,days,created_at) VALUES(?,?,?,?,?,?)',[$id,$row['account'],$row['profile'],$due,$days,$n]);
                }
                if ($n >= $due) $result[]=['account_ref'=>$row['account'],'profile_id'=>$row['profile'],'revision'=>(int)$row['revision'],'delete_due_at'=>$due,'action'=>'review_retention_deletion'];
            }
            return ['reminders'=>$this->query($this->db,'SELECT id,account AS account_ref,profile AS profile_id,due AS delete_due_at,days,created_at,delivered_at FROM reminders ORDER BY created_at,id')->fetchAll(),'due'=>$result];
        });
    }

    /** INTERNAL adapter records only real delivery evidence. A queue entry is not a sent warning. */
    public function recordReminderDelivery(string $jobId, string $deliveryReceipt): void {
        if (!preg_match('/^[a-f0-9]{64}$/D',$jobId) || !preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D',$deliveryReceipt)) throw new ProgressError('INVALID_DELIVERY_RECEIPT');
        $this->transaction(function() use ($jobId,$deliveryReceipt) {
            $row=$this->query($this->db,'SELECT * FROM reminders WHERE id=?',[$jobId])->fetch();
            if (!$row) throw new ProgressError('REMINDER_NOT_FOUND',404);
            if ($row['delivered_at'] !== null) return;
            $this->query($this->db,'UPDATE reminders SET delivered_at=?,delivery_receipt=? WHERE id=?',[$this->now(),hash_hmac('sha256',$deliveryReceipt,$this->key),$jobId]);
        });
    }

    /** INTERNAL retention worker; missing warnings block, late warnings receive their full notice period. */
    public function expire(VerifiedProgressAccount $owner, string $profile, int $baseRevision): array {
        $this->profile($profile); $a=$this->account($owner);
        return $this->transaction(function() use ($a,$profile,$baseRevision) {
            if ($t=$this->tombstone($a,$profile)) return $this->deletionResponse($t);
            $row=$this->row($a,$profile); if (!$row) throw new ProgressError('PROFILE_NOT_FOUND',404); $this->cas($row,$baseRevision);
            $due=self::anniversary((int)$row['activity']);
            if ($this->now() < $due) throw new ProgressError('RETENTION_NOT_DUE',409);
            foreach ([30,7] as $days) {
                $r=$this->query($this->db,'SELECT delivered_at FROM reminders WHERE account=? AND profile=? AND due=? AND days=?',[$a,$profile,$due,$days])->fetch();
                if (!$r || $r['delivered_at'] === null) throw new ProgressError('REMINDERS_NOT_DELIVERED',409);
                if ($this->now() < (int)$r['delivered_at']+$days*self::DAY) throw new ProgressError('REMINDER_NOTICE_PERIOD_PENDING',409,['retry_after'=>(int)$r['delivered_at']+$days*self::DAY]);
            }
            return $this->erase($a,$profile,$baseRevision+1,'inactivity','retention-'.$due);
        });
    }

    /** INTERNAL restoration gate: apply ledger before enabling traffic on a restored snapshot. */
    public function reconcileRestoredSnapshot(): int {
        return $this->transaction(function() {
            $count=0;
            foreach ($this->query($this->ledger,'SELECT * FROM deleted')->fetchAll() as $t) {
                $count += $this->query($this->db,'DELETE FROM profiles WHERE account=? AND profile=?',[$t['account'],$t['profile']])->rowCount();
                $this->query($this->db,'DELETE FROM requests WHERE account=? AND profile=?',[$t['account'],$t['profile']]);
                $this->query($this->db,'DELETE FROM reminders WHERE account=? AND profile=?',[$t['account'],$t['profile']]);
            }
            return $count;
        });
    }

    /** Operational queue, not proof that external backups were actually erased. */
    public function backupDeletionWork(): array {
        $n=$this->now(); $rows=$this->query($this->ledger,'SELECT account AS account_ref,profile AS profile_id,deleted_at,backup_deadline,erased_at FROM deleted WHERE erased_at IS NULL ORDER BY backup_deadline')->fetchAll();
        foreach ($rows as &$r) $r['overdue']=$n > (int)$r['backup_deadline']; return $rows;
    }
    /** INTERNAL operator adapter only, after all affected backups have verifiably been erased. */
    public function recordBackupErasure(VerifiedProgressAccount $owner, string $profile, string $evidence): void {
        $this->profile($profile);
        if (!preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D',$evidence)) throw new ProgressError('INVALID_ERASURE_EVIDENCE');
        $a=$this->account($owner);
        if (!$this->tombstone($a,$profile)) throw new ProgressError('PROFILE_NOT_DELETED',409);
        $this->query($this->ledger,'UPDATE deleted SET erased_at=COALESCE(erased_at,?),erasure_evidence=COALESCE(erasure_evidence,?) WHERE account=? AND profile=?',[$this->now(),hash_hmac('sha256',$evidence,$this->key),$a,$profile]);
    }
}
