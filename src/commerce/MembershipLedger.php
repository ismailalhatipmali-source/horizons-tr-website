<?php
declare(strict_types=1);
namespace HorizonsCommerce;
use PDO;
use RuntimeException;
use Throwable;

/** Implemented only by the private activation service, never by a browser.
 * Grant is idempotent by member_id, preserves an existing account's stable ID
 * and password/progress, and queues first-activation email at most once.
 * Revoke targets this membership only, cancels invitations and online sessions,
 * and enforces the issuer's bounded offline lease. No plaintext password or
 * signing key belongs in this interface or the public website repository. */
interface MembershipIssuer {
    public function grantMembership(array $request): string;
    public function revokeMembership(string $memberId, string $accountId): void;
}

interface RenewableMembershipIssuer extends MembershipIssuer {
    public function renewGroup(string $groupId,string $renewalId,string $plan,?int $expiresAt):void;
}

/** Private integration component; no public route, no deployment/SMTP worker.
 * Actor account IDs must come from verified server authentication, not request
 * fields. A verified PurchaseLedger is the only source of paid owner grants. */
final class MembershipLedger {
    private PDO $db;
    public function __construct(string $file, string $documentRoot, private readonly string $key) {
        $dir=realpath(dirname($file));$web=realpath($documentRoot);
        if(strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES || $dir===false || $web===false || $dir===$web || str_starts_with($dir,$web.DIRECTORY_SEPARATOR) || is_link($file) || (file_exists($file)&&!is_file($file)))throw new RuntimeException('PRIVATE_DATABASE_REQUIRED');
        $this->db=new PDO('sqlite:'.$dir.DIRECTORY_SEPARATOR.basename($file),null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);chmod($file,0600);
        $this->db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
        $this->db->exec("CREATE TABLE IF NOT EXISTS membership_meta (id INTEGER PRIMARY KEY CHECK(id=1), key_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS membership_groups (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, owner_account TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('individual','family','institution')), starts_at INTEGER NOT NULL, expires_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS membership_seats (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES membership_groups(id), email_hash TEXT NOT NULL, email_cipher TEXT NOT NULL, account_id TEXT, state TEXT NOT NULL CHECK(state IN ('pending','active','removing','removed')), owner INTEGER NOT NULL DEFAULT 0);
        CREATE UNIQUE INDEX IF NOT EXISTS membership_email_active ON membership_seats(email_hash) WHERE state!='removed';
        CREATE TABLE IF NOT EXISTS membership_jobs (member_id TEXT NOT NULL REFERENCES membership_seats(id), kind TEXT NOT NULL CHECK(kind IN ('grant','revoke')), done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(member_id,kind));");
        $columns=array_column($this->db->query('PRAGMA table_info(membership_groups)')->fetchAll(PDO::FETCH_ASSOC),'name');
        if(!in_array('plan',$columns,true))$this->db->exec("ALTER TABLE membership_groups ADD COLUMN plan TEXT NOT NULL DEFAULT 'annual'");
        $this->db->exec('CREATE TABLE IF NOT EXISTS membership_renewals(order_id TEXT PRIMARY KEY,group_id TEXT NOT NULL,plan TEXT NOT NULL,expires_at INTEGER,done INTEGER NOT NULL DEFAULT 0)');
        $hash=hash_hmac('sha256','horizons-membership-key-check',$key);
        $this->db->prepare('INSERT OR IGNORE INTO membership_meta(id,key_hash) VALUES(1,?)')->execute([$hash]);
        if(!hash_equals($hash,$this->db->query('SELECT key_hash FROM membership_meta WHERE id=1')->fetchColumn()))throw new RuntimeException('MEMBERSHIP_KEY_CHANGED');
    }
    private function one(string $sql,array $args): array|false {$q=$this->db->prepare($sql);$q->execute($args);return $q->fetch(PDO::FETCH_ASSOC);}
    private function atomic(callable $f): mixed {$this->db->exec('BEGIN IMMEDIATE');try{$r=$f();$this->db->exec('COMMIT');return $r;}catch(Throwable $e){$this->db->exec('ROLLBACK');throw $e;}}
    private function email(string $email): string {$email=strtolower(trim($email));if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new RuntimeException('EMAIL_INVALID');return $email;}
    private function emailHash(string $email): string{return hash_hmac('sha256',$email,$this->key);}
    private function encode(string $email): string {$nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);return base64_encode($nonce.sodium_crypto_secretbox($email,$nonce,$this->key));}
    private function decode(string $cipher): string {$raw=base64_decode($cipher,true);if($raw===false)throw new RuntimeException('MEMBERSHIP_STORAGE_INVALID');$email=sodium_crypto_secretbox_open(substr($raw,24),substr($raw,0,24),$this->key);if($email===false)throw new RuntimeException('MEMBERSHIP_STORAGE_INVALID');return $email;}
    private function identifier(string $id): string {if(!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/D',$id))throw new RuntimeException('ACCOUNT_INVALID');return $id;}
    private function group(string $id): array {$g=$this->one('SELECT * FROM membership_groups WHERE id=?',[$id]);if(!$g)throw new RuntimeException('GROUP_NOT_FOUND');return $g;}
    private function authorize(string $groupId,string $actor,int $now): array {$g=$this->group($groupId);if(!hash_equals($g['owner_account'],$actor))throw new RuntimeException('MEMBERSHIP_FORBIDDEN');if((int)$g['revoked']!==0||(int)$g['starts_at']>$now||($g['expires_at']!==null&&(int)$g['expires_at']<=$now))throw new RuntimeException('MEMBERSHIP_EXPIRED');return $g;}
    private function end(int $start,string $plan): ?int {
        if($plan==='lifetime')return null;
        $d=(new \DateTimeImmutable('@'.$start))->setTimezone(new \DateTimeZone('UTC'));
        $first=$d->modify('first day of this month')->modify('+'.($plan==='annual'?12:1).' months');
        return $first->setDate((int)$first->format('Y'),(int)$first->format('m'),min((int)$d->format('d'),(int)$first->format('t')))->getTimestamp();
    }
    public function fulfilOwner(string $orderId, PurchaseLedger $purchases): array {
        $o=$purchases->order($orderId);
        if($o['status']!=='access_ready'||!$o['account_id']||!$o['paid_at'])throw new RuntimeException('VERIFIED_ACCESS_REQUIRED');
        $type=$o['account_type'];if(!in_array($type,['individual','family','institution'],true)||($type==='institution'&&$o['plan']!=='annual'))throw new RuntimeException('ACCOUNT_TYPE_INVALID');
        $start=strtotime($o['paid_at']);if($start===false)throw new RuntimeException('ORDER_INVALID');
        return $this->atomic(function()use($o,$type,$start){
            $prior=$this->one('SELECT * FROM membership_groups WHERE order_id=?',[$o['order_id']]);if($prior)return $prior;
            $group='grp_'.hash('sha256',$o['order_id']);$owner=$this->identifier($o['account_id']);
            $this->db->prepare('INSERT INTO membership_groups(id,order_id,owner_account,type,starts_at,expires_at) VALUES(?,?,?,?,?,?)')->execute([$group,$o['order_id'],$owner,$type,$start,$this->end($start,$o['plan'])]);
            $this->db->prepare('UPDATE membership_groups SET plan=? WHERE id=?')->execute([$o['plan'],$group]);
            if($type!=='institution')$this->insertSeat($group,$this->email($o['email']),$owner,true);
            return $this->group($group);
        });
    }
    private function insertSeat(string $group,string $email,?string $account,bool $owner=false): array {
        $hash=$this->emailHash($email);
        if($this->one("SELECT id FROM membership_seats WHERE email_hash=? AND state!='removed'",[$hash]))throw new RuntimeException('EMAIL_ALREADY_ASSIGNED');
        $id='mem_'.bin2hex(random_bytes(16));$state=$owner?'active':'pending';
        $this->db->prepare('INSERT INTO membership_seats(id,group_id,email_hash,email_cipher,account_id,state,owner) VALUES(?,?,?,?,?,?,?)')->execute([$id,$group,$hash,$this->encode($email),$account,$state,(int)$owner]);
        if(!$owner)$this->db->prepare("INSERT INTO membership_jobs(member_id,kind) VALUES(?,'grant')")->execute([$id]);
        return ['id'=>$id,'email'=>$email,'state'=>$state,'owner'=>$owner];
    }
    public function invite(string $groupId,string $actor,string $email,string $confirmation,bool $permanentAcknowledged,int $now): array {
        $email=$this->email($email);if($email!==$this->email($confirmation))throw new RuntimeException('EMAIL_CONFIRMATION_REQUIRED');
        return $this->atomic(function()use($groupId,$actor,$email,$permanentAcknowledged,$now){
            $g=$this->authorize($groupId,$actor,$now);if($g['type']==='individual')throw new RuntimeException('LEARNER_LIMIT');
            if($g['type']==='family'&&!$permanentAcknowledged)throw new RuntimeException('PERMANENT_EMAIL_ACK_REQUIRED');
            $same=$this->one("SELECT * FROM membership_seats WHERE group_id=? AND email_hash=? AND state!='removed'",[$groupId,$this->emailHash($email)]);
            if($same)return ['id'=>$same['id'],'email'=>$email,'state'=>$same['state'],'owner'=>(bool)$same['owner']];
            $q=$this->db->prepare("SELECT count(*) FROM membership_seats WHERE group_id=? AND state!='removed'");$q->execute([$groupId]);
            if((int)$q->fetchColumn()>=($g['type']==='family'?5:100))throw new RuntimeException('LEARNER_LIMIT');
            return $this->insertSeat($groupId,$email,null);
        });
    }
    public function learners(string $groupId,string $actor,int $now): array {
        $this->authorize($groupId,$actor,$now);$q=$this->db->prepare("SELECT * FROM membership_seats WHERE group_id=? AND state!='removed' ORDER BY owner DESC,id");$q->execute([$groupId]);
        return array_map(fn($s)=>['id'=>$s['id'],'email'=>$this->decode($s['email_cipher']),'state'=>$s['state'],'owner'=>(bool)$s['owner']],$q->fetchAll(PDO::FETCH_ASSOC));
    }
    public function remove(string $groupId,string $actor,string $memberId,int $now): void {
        $this->atomic(function()use($groupId,$actor,$memberId,$now){
            $g=$this->authorize($groupId,$actor,$now);if($g['type']!=='institution')throw new RuntimeException('EMAIL_PERMANENT');
            $s=$this->one('SELECT * FROM membership_seats WHERE id=? AND group_id=?',[$memberId,$groupId]);if(!$s)throw new RuntimeException('MEMBER_NOT_FOUND');
            if(in_array($s['state'],['removed','removing'],true))return;
            // Do not free a slot until the private issuer confirms revocation,
            // including a grant which may have raced a worker acknowledgement.
            $this->db->prepare("UPDATE membership_seats SET state='removing' WHERE id=?")->execute([$memberId]);
            $this->db->prepare("INSERT OR IGNORE INTO membership_jobs(member_id,kind) VALUES(?,'revoke')")->execute([$memberId]);
        });
    }
    /** Trusted worker only. Serialize grant/revoke under the SQLite write lock.
     * Keep issuer calls bounded; retries use member_id, never generate new grants.
     * Owner removal/invitation requests cannot race this issuer acknowledgement. */
    public function work(MembershipIssuer $issuer,int $now): int {
        return $this->atomic(function()use($issuer,$now){
            $q=$this->db->query("SELECT j.member_id,j.kind,s.*,g.type,g.plan,g.starts_at,g.expires_at,g.revoked FROM membership_jobs j JOIN membership_seats s ON s.id=j.member_id JOIN membership_groups g ON g.id=s.group_id WHERE j.done=0 ORDER BY CASE j.kind WHEN 'revoke' THEN 0 ELSE 1 END LIMIT 1");$job=$q->fetch(PDO::FETCH_ASSOC);if(!$job)return 0;
            if($job['kind']==='grant') {
                if($job['state']!=='pending'||(int)$job['revoked']!==0||($job['expires_at']!==null&&(int)$job['expires_at']<=$now)) {
                    $this->db->prepare("UPDATE membership_jobs SET done=1 WHERE member_id=? AND kind='grant'")->execute([$job['id']]);return 1;
                }
                $account=$this->identifier($issuer->grantMembership(['member_id'=>$job['id'],'group_id'=>$job['group_id'],'account_type'=>$job['type'],'plan'=>$job['plan'],'email'=>$this->decode($job['email_cipher']),'starts_at'=>(int)$job['starts_at'],'expires_at'=>$job['expires_at']===null?null:(int)$job['expires_at'],'device_policy'=>'any_device']));
                // A private issuer may not collapse two distinct emails into one
                // progress identity. The issuer must also enforce email binding.
                $other=$this->one("SELECT id FROM membership_seats WHERE account_id=? AND email_hash!=? AND state!='removed'",[$account,$job['email_hash']]);if($other)throw new RuntimeException('ACCOUNT_EMAIL_MISMATCH');
                $this->db->prepare("UPDATE membership_seats SET account_id=?,state='active' WHERE id=?")->execute([$account,$job['id']]);
            } else {
                $issuer->revokeMembership($job['id'],$job['account_id']??'');
                $this->db->prepare("UPDATE membership_seats SET state='removed',email_cipher='',email_hash='' WHERE id=?")->execute([$job['id']]);
                $this->db->prepare("UPDATE membership_jobs SET done=1 WHERE member_id=? AND kind='grant'")->execute([$job['id']]);
            }
            $this->db->prepare('UPDATE membership_jobs SET done=1 WHERE member_id=? AND kind=?')->execute([$job['id'],$job['kind']]);return 1;
        });
    }
    public function policy(string $groupId,string $actor,int $now):array {
        $g=$this->group($groupId);$owner=hash_equals($g['owner_account'],$actor);
        return ['account_type'=>$g['type'],'max_learners'=>['individual'=>1,'family'=>5,'institution'=>100][$g['type']],'can_manage'=>$owner,'learners'=>$owner?$this->learners($groupId,$actor,$now):[]];
    }
    public function ownerGroup(string $account,string $type):array|false {
        return $this->one('SELECT * FROM membership_groups WHERE owner_account=? AND type=? AND revoked=0 ORDER BY starts_at DESC LIMIT 1',[$account,$type]);
    }
    public function assertPurchaseAllowed(string $email,string $type,PurchaseLedger $purchases):void {
        $seat=$this->one("SELECT s.owner,g.type,g.expires_at FROM membership_seats s JOIN membership_groups g ON g.id=s.group_id WHERE s.email_hash=? AND s.state!='removed'",[$this->emailHash($this->email($email))]);
        if($seat&&(!(int)$seat['owner']||$seat['type']!==$type))throw new RuntimeException('EMAIL_ALREADY_ASSIGNED');
        if($seat&&$seat['expires_at']===null)throw new RuntimeException('SUBSCRIPTION_ALREADY_ACTIVE');
        $account=$purchases->existingAccount($email);if($account){$owned=$this->one('SELECT type FROM membership_groups WHERE owner_account=? AND revoked=0 LIMIT 1',[$account]);if($owned&&$owned['type']!==$type)throw new RuntimeException('EMAIL_ALREADY_ASSIGNED');}
    }
    public function renewOwner(string $orderId,PurchaseLedger $purchases,string $account,RenewableMembershipIssuer $issuer):array|false {
        $o=$purchases->order($orderId);if(!in_array($o['status'],['paid','access_ready'],true)||!$o['paid_at'])throw new RuntimeException('PAYMENT_REQUIRED');
        return $this->atomic(function()use($o,$account,$issuer){
            $g=$this->ownerGroup($account,$o['account_type']);if(!$g||$g['order_id']===$o['order_id'])return false;
            $prior=$this->one('SELECT * FROM membership_renewals WHERE order_id=?',[$o['order_id']]);if($prior&&(int)$prior['done'])return $g;
            $end=$prior?($prior['expires_at']===null?null:(int)$prior['expires_at']):($g['expires_at']===null?null:$this->end(max((int)$g['expires_at'],strtotime($o['paid_at'])),$o['plan']));
            $plan=$end===null?'lifetime':$o['plan'];
            if(!$prior)$this->db->prepare('INSERT INTO membership_renewals(order_id,group_id,plan,expires_at) VALUES(?,?,?,?)')->execute([$o['order_id'],$g['id'],$plan,$end]);
            $issuer->renewGroup($g['id'],$o['order_id'],$plan,$end);
            $this->db->prepare('UPDATE membership_groups SET plan=?,expires_at=? WHERE id=?')->execute([$plan,$end,$g['id']]);
            $this->db->prepare("UPDATE membership_jobs SET done=0 WHERE kind='grant' AND member_id IN (SELECT id FROM membership_seats WHERE group_id=? AND state='pending')")->execute([$g['id']]);
            $this->db->prepare('UPDATE membership_renewals SET done=1 WHERE order_id=?')->execute([$o['order_id']]);return $this->group($g['id']);
        });
    }

}
