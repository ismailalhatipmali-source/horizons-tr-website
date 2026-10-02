<?php
declare(strict_types=1);
namespace Horizons;

require_once __DIR__.'/Core.php';
require_once __DIR__.'/../commerce/MembershipLedger.php';

/** Private worker boundary. This does not expose an HTTP grant endpoint.
 * Activation support and delivery must be installed before collection is enabled.
 * Existing account identifiers and passwords are never replaced. */
final class MembershipBridge implements \HorizonsCommerce\RenewableMembershipIssuer {
    public function __construct(private readonly Store $store, private readonly Crypto $crypto, private readonly Clock $clock = new SystemClock) {
        $store->query("CREATE TABLE IF NOT EXISTS membership_rights (
            member_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id),
            email_hash TEXT NOT NULL, email_cipher TEXT NOT NULL, account_type TEXT NOT NULL,
            starts_at INTEGER NOT NULL, expires_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL, revoked_at INTEGER)");
        $store->query("CREATE TABLE IF NOT EXISTS membership_delivery (
            member_id TEXT PRIMARY KEY REFERENCES membership_rights(member_id),
            state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, delivered_at INTEGER)");
        $store->query('CREATE TABLE IF NOT EXISTS membership_revocations(member_id TEXT PRIMARY KEY,revoked_at INTEGER NOT NULL)');
        $store->query('CREATE TABLE IF NOT EXISTS membership_extensions(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,plan TEXT NOT NULL,expires_at INTEGER)');
        $columns=array_column($store->query('PRAGMA table_info(membership_rights)')->fetchAll(\PDO::FETCH_ASSOC),'name');
        if(!in_array('plan',$columns,true))$store->query("ALTER TABLE membership_rights ADD COLUMN plan TEXT NOT NULL DEFAULT 'annual'");
        if(!in_array('locale',$columns,true))$store->query("ALTER TABLE membership_rights ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'");
    }
    private function identifier(mixed $id): string {
        if(!is_string($id)||!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/D',$id))throw new ServiceError('INVALID_REQUEST');
        return $id;
    }
    public function grantMembership(array $request): string {
        $member=$this->identifier($request['member_id']??null);$group=$this->identifier($request['group_id']??null);
        $type=$request['account_type']??null;$start=$request['starts_at']??null;$end=$request['expires_at']??null;
        if(!in_array($type,['individual','family','institution'],true)||($request['device_policy']??null)!=='any_device'
            ||!is_int($start)||$start<0||($end!==null&&(!is_int($end)||$end<=$start))
            ||($type==='institution'&&$end===null)||!is_string($request['email']??null))throw new ServiceError('INVALID_REQUEST');
        $plan=$request['plan']??($end===null?'lifetime':($end-$start<=32*86400?'monthly':'annual'));
        if(!in_array($plan,['monthly','annual','lifetime'],true)||($type==='institution'&&$plan!=='annual')||(($plan==='lifetime')!==($end===null)))throw new ServiceError('INVALID_REQUEST');
        $address=email($request['email']);$hash=$this->crypto->keyed('email',$address);$now=$this->clock->now();
        if($start>$now||($end!==null&&$end<=$now))throw new ServiceError('ENTITLEMENT_EXPIRED',403);
        $this->store->begin();
        try {
            if($this->store->query('SELECT 1 FROM membership_revocations WHERE member_id=?',[$member])->fetchColumn())throw new ServiceError('ENTITLEMENT_EXPIRED',403);
            $prior=$this->store->query('SELECT * FROM membership_rights WHERE member_id=?',[$member])->fetch(\PDO::FETCH_ASSOC);
            if($prior){
                if(!hash_equals($prior['group_id'],$group)||!hash_equals($prior['email_hash'],$hash)
                    ||$prior['plan']!==$plan||$prior['account_type']!==$type||(int)$prior['starts_at']!==$start
                    ||($prior['expires_at']===null?null:(int)$prior['expires_at'])!==$end)throw new ServiceError('MEMBERSHIP_CONFLICT',409);
                if((int)$prior['revoked']!==0)throw new ServiceError('ENTITLEMENT_EXPIRED',403);
                $this->store->commit();return $prior['account_id'];
            }
            // Store::account reuses the original trial/paid identity by email hash.
            $account=$this->store->account($hash,$now);
            $this->store->query('INSERT INTO membership_rights(member_id,group_id,account_id,email_hash,email_cipher,account_type,starts_at,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                [$member,$group,$account,$hash,$this->crypto->seal($address),$type,$start,$end,$now]);
            $locale=is_string($request['locale']??null)?substr($request['locale'],0,12):'en';
            $this->store->query('UPDATE membership_rights SET plan=?,locale=? WHERE member_id=?',[$plan,$locale,$member]);
            $id='mb_'.hash('sha256',$member);
            $this->store->query("INSERT INTO entitlements(id,sale_id,email_hash,email_cipher,revoked,checked_at,account_id,plan,channel,starts_at,expires_at,max_devices,source) VALUES(?,?,?,?,0,?,?,?,'membership',?,?,0,'membership_v1')",[$id,$id,$hash,$this->crypto->seal($address),$now,$account,$plan,$start,$end]);
            $this->store->query('INSERT INTO membership_delivery(member_id,created_at) VALUES(?,?)',[$member,$now]);
            $this->store->commit();return $account;
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    public function revokeMembership(string $memberId,string $accountId): void {
        $member=$this->identifier($memberId);$account=$accountId===''?'':$this->identifier($accountId);
        $this->store->begin();
        try{
            $row=$this->store->query('SELECT * FROM membership_rights WHERE member_id=?',[$member])->fetch(\PDO::FETCH_ASSOC);
            if($row){
                if($account!==''&&!hash_equals($row['account_id'],$account))throw new ServiceError('MEMBERSHIP_CONFLICT',409);
                $this->store->query('UPDATE membership_rights SET revoked=1,revoked_at=COALESCE(revoked_at,?) WHERE member_id=?',[$this->clock->now(),$member]);
                $this->store->query("UPDATE membership_delivery SET state='cancelled' WHERE member_id=? AND state='pending'",[$member]);
            }
            $this->store->query('INSERT OR IGNORE INTO membership_revocations VALUES(?,?)',[$member,$this->clock->now()]);
            $this->store->query('UPDATE entitlements SET revoked=1 WHERE id=?',['mb_'.hash('sha256',$member)]);
            // No account/password/progress removal: unrelated rights remain valid.
            $this->store->commit();
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    /** Server-side lookup only; not a bearer credential or browser account claim. */
    public function active(string $memberId,string $accountId): array {
        $row=$this->store->query('SELECT * FROM membership_rights WHERE member_id=? AND account_id=?',[$this->identifier($memberId),$this->identifier($accountId)])->fetch(\PDO::FETCH_ASSOC);
        $now=$this->clock->now();
        if(!$row||(int)$row['revoked']!==0||(int)$row['starts_at']>$now||($row['expires_at']!==null&&(int)$row['expires_at']<=$now))throw new ServiceError('ENTITLEMENT_EXPIRED',403);
        return $row;
    }
    public function renewGroup(string $groupId,string $renewalId,string $plan,?int $expiresAt):void {
        $group=$this->identifier($groupId);$id=$this->identifier($renewalId);
        if(!in_array($plan,['monthly','annual','lifetime'],true)||(($plan==='lifetime')!==($expiresAt===null))||($expiresAt!==null&&$expiresAt<=$this->clock->now()))throw new ServiceError('INVALID_REQUEST');
        $this->store->begin();try{
            $old=$this->store->query('SELECT * FROM membership_extensions WHERE id=?',[$id])->fetch(\PDO::FETCH_ASSOC);
            if($old){if($old['group_id']!==$group||$old['plan']!==$plan||($old['expires_at']===null?null:(int)$old['expires_at'])!==$expiresAt)throw new ServiceError('MEMBERSHIP_CONFLICT',409);$this->store->commit();return;}
            $rows=$this->store->query('SELECT * FROM membership_rights WHERE group_id=? AND revoked=0',[$group])->fetchAll(\PDO::FETCH_ASSOC);
            if(!$rows)throw new ServiceError('MEMBERSHIP_CONFLICT',409);
            foreach($rows as $r){
                if(($r['account_type']==='institution'&&$plan!=='annual')||($r['expires_at']===null&&$expiresAt!==null)||($expiresAt!==null&&$expiresAt<(int)$r['expires_at']))throw new ServiceError('MEMBERSHIP_CONFLICT',409);
                $this->store->query('UPDATE membership_rights SET plan=?,expires_at=? WHERE member_id=?',[$plan,$expiresAt,$r['member_id']]);
                $this->store->query('UPDATE entitlements SET plan=?,expires_at=? WHERE id=? AND revoked=0',[$plan,$expiresAt,'mb_'.hash('sha256',$r['member_id'])]);
            }
            $this->store->query('INSERT INTO membership_extensions VALUES(?,?,?,?)',[$id,$group,$plan,$expiresAt]);$this->store->commit();
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }

}
