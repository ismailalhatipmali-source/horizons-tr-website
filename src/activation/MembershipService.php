<?php
declare(strict_types=1);
namespace Horizons;
require_once __DIR__.'/MembershipBridge.php';

/** Account-based activation; no password, code or token is logged. */
final class MembershipService {
    public function __construct(private readonly Store $store,private readonly Crypto $crypto,private readonly Mailer $mailer,private readonly Clock $clock=new SystemClock) {
        $store->query('CREATE TABLE IF NOT EXISTS membership_codes(email_hash TEXT PRIMARY KEY,code_hash TEXT NOT NULL,code_cipher TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used INTEGER NOT NULL DEFAULT 0)');
        $store->query('CREATE TABLE IF NOT EXISTS membership_setup(token_hash TEXT PRIMARY KEY,email_hash TEXT NOT NULL,device TEXT NOT NULL,key_hash TEXT NOT NULL,password_version INTEGER NOT NULL,expires INTEGER NOT NULL)');
        $store->query('CREATE TABLE IF NOT EXISTS membership_auth(id TEXT PRIMARY KEY,claim TEXT NOT NULL,nonce_hash TEXT NOT NULL,expires INTEGER NOT NULL)');
        $store->query('CREATE TABLE IF NOT EXISTS membership_sessions(token_hash TEXT PRIMARY KEY,claim TEXT NOT NULL,expires INTEGER NOT NULL)');
    }
    private function right(string $hash):array|false {
        return $this->store->query('SELECT * FROM membership_rights WHERE email_hash=? AND revoked=0 AND starts_at<=? AND (expires_at IS NULL OR expires_at>?) ORDER BY expires_at IS NULL DESC,expires_at DESC,member_id LIMIT 1',[$hash,$this->clock->now(),$this->clock->now()])->fetch(\PDO::FETCH_ASSOC);
    }
    public function hasAccess(string $address):bool{return (bool)$this->right($this->crypto->keyed('email',email($address)));}
    private function identity(array $input):array {
        $device=$input['device_id']??null;$pub=$input['public_key']??null;
        if(!is_string($device)||!preg_match('/^[a-f0-9]{64}$/D',$device)||!is_string($pub))throw new ServiceError('INVALID_REQUEST');
        [,$der]=Crypto::publicKey($pub);return [$device,$pub,hash('sha256',$der)];
    }
    public function resend(array $input,string $ip):array {
        if(!is_string($input['email']??null))throw new ServiceError('INVALID_REQUEST');
        $hash=$this->crypto->keyed('email',email($input['email']));
        $ipOK=$this->store->throttle($this->crypto->keyed('member-resend-ip',$ip),3600,20);
        $emailOK=$this->store->throttle($this->crypto->keyed('member-resend-email',$hash),3600,3);
        if(!$ipOK||!$emailOK)throw new ServiceError('RATE_LIMITED',429);
        $right=$this->right($hash);
        if($right)$this->store->query("UPDATE membership_delivery SET state='pending' WHERE member_id=? AND state='sent'",[$right['member_id']]);
        return ['ok'=>true];
    }
    /** The private worker serializes delivery. Retry uses the same unexpired code. */
    public function deliver():bool {
        $this->store->begin();try{
            $job=$this->store->query("SELECT r.* FROM membership_delivery d JOIN membership_rights r ON r.member_id=d.member_id WHERE d.state='pending' ORDER BY d.created_at LIMIT 1")->fetch(\PDO::FETCH_ASSOC);
            if(!$job){$this->store->commit();return false;}$now=$this->clock->now();
            if((int)$job['revoked']||($job['expires_at']!==null&&(int)$job['expires_at']<=$now)){$this->store->query("UPDATE membership_delivery SET state='cancelled' WHERE member_id=?",[$job['member_id']]);$this->store->commit();return true;}
            $old=$this->store->query('SELECT * FROM membership_codes WHERE email_hash=?',[$job['email_hash']])->fetch(\PDO::FETCH_ASSOC);
            if($old&&(int)$old['expires']>$now&&!(int)$old['used'])$code=$this->crypto->open($old['code_cipher']);
            else{
                $code=str_pad((string)random_int(0,99999999),8,'0',STR_PAD_LEFT);
                $this->store->query('INSERT INTO membership_codes VALUES(?,?,?,?,0,0) ON CONFLICT(email_hash) DO UPDATE SET code_hash=excluded.code_hash,code_cipher=excluded.code_cipher,expires=excluded.expires,attempts=0,used=0',[$job['email_hash'],$this->crypto->keyed('membership-code',$job['email_hash'].':'.$code),$this->crypto->seal($code),$now+600]);
            }
            $this->store->commit();
            $this->mailer->code($this->crypto->open($job['email_cipher']),$code,$job['locale']);
            $this->store->query("UPDATE membership_delivery SET state='sent',delivered_at=? WHERE member_id=? AND state='pending'",[$now,$job['member_id']]);return true;
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    public function checkCode(array $input,string $ip):array {
        [$device,,$keyHash]=$this->identity($input);$address=$input['email']??null;$code=$input['code']??null;
        if(!is_string($address)||!is_string($code)||!preg_match('/^[0-9]{8}$/D',$code))throw new ServiceError('OTP_INVALID');
        $hash=$this->crypto->keyed('email',email($address));$now=$this->clock->now();
        $ipOK=$this->store->throttle($this->crypto->keyed('member-check-ip',$ip),3600,60);$emailOK=$this->store->throttle($this->crypto->keyed('member-check-email',$hash),3600,10);
        if(!$ipOK||!$emailOK)throw new ServiceError('OTP_INVALID',429);
        $this->store->begin();try{
            $row=$this->store->query('SELECT * FROM membership_codes WHERE email_hash=?',[$hash])->fetch(\PDO::FETCH_ASSOC);
            if(!$row||(int)$row['used']||(int)$row['attempts']>=5||(int)$row['expires']<=$now)throw new ServiceError('OTP_INVALID');
            $this->store->query('UPDATE membership_codes SET attempts=attempts+1 WHERE email_hash=?',[$hash]);
            if(!hash_equals($row['code_hash'],$this->crypto->keyed('membership-code',$hash.':'.$code))){$this->store->commit();throw new ServiceError('OTP_INVALID');}
            if(!$this->right($hash))throw new ServiceError('ENTITLEMENT_EXPIRED',403);
            $version=$this->store->query('SELECT password_version FROM accounts WHERE email_hash=?',[$hash])->fetchColumn();$token=bin2hex(random_bytes(32));
            $this->store->query("UPDATE membership_codes SET used=1,code_cipher='' WHERE email_hash=?",[$hash]);
            $this->store->query('DELETE FROM membership_setup WHERE email_hash=? OR expires<=?',[$hash,$now]);
            $this->store->query('INSERT INTO membership_setup VALUES(?,?,?,?,?,?)',[$this->crypto->keyed('membership-setup',$token),$hash,$device,$keyHash,(int)$version,$now+600]);
            $this->store->commit();return ['ok'=>true,'setup_token'=>$token,'expires_in'=>600];
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    public function setup(array $input,string $ip):array {
        [$device,$pub,$keyHash]=$this->identity($input);$token=$input['setup_token']??null;$password=$input['new_password']??null;
        if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))throw new ServiceError('OTP_INVALID');
        if(!is_string($password)||strlen($password)>256||preg_match('//u',$password)!==1||preg_match('/[\x00-\x1F\x7F]/u',$password)||preg_match_all('/./us',$password)<12)throw new ServiceError('PASSWORD_WEAK');
        if(!$this->store->throttle($this->crypto->keyed('member-setup-ip',$ip),3600,60))throw new ServiceError('OTP_INVALID',429);
        $digest=hash_hmac('sha256',"account-password-v1\0".$password,$this->crypto->dataKey);$passwordHash=password_hash($digest,PASSWORD_BCRYPT,['cost'=>12]);
        $this->store->begin();try{
            $row=$this->store->query('SELECT * FROM membership_setup WHERE token_hash=?',[$this->crypto->keyed('membership-setup',$token)])->fetch(\PDO::FETCH_ASSOC);
            if(!$row||(int)$row['expires']<=$this->clock->now()||!hash_equals($row['device'],$device)||!hash_equals($row['key_hash'],$keyHash))throw new ServiceError('OTP_INVALID');
            $right=$this->right($row['email_hash']);if(!$right)throw new ServiceError('ENTITLEMENT_EXPIRED',403);
            $result=$this->allocate($right,$device,$pub,$keyHash,(int)$row['password_version'],$passwordHash);
            $this->store->query('DELETE FROM membership_setup WHERE email_hash=?',[$row['email_hash']]);$this->store->commit();return $result;
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    public function issue(string $address,string $device,string $pub,string $keyHash,?int $version=null,?string $passwordHash=null):array {
        $this->store->begin();try{
            $right=$this->right($this->crypto->keyed('email',email($address)));if(!$right)throw new ServiceError('ENTITLEMENT_EXPIRED',403);
            $result=$this->allocate($right,$device,$pub,$keyHash,$version,$passwordHash);$this->store->commit();return $result;
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    private function allocate(array $right,string $device,string $pub,string $keyHash,?int $version,?string $passwordHash):array {
        $account=$this->store->query('SELECT * FROM accounts WHERE id=?',[$right['account_id']])->fetch(\PDO::FETCH_ASSOC);
        if(!$account||($version!==null&&(int)$account['password_version']!==$version))throw new ServiceError('PASSWORD_INVALID',403);
        if($passwordHash===null&&empty($account['password_hash']))throw new ServiceError('PASSWORD_REQUIRED',403);
        $now=$this->clock->now();$id='mb_'.hash('sha256',$right['member_id']);$e=$this->store->query('SELECT * FROM entitlements WHERE id=? AND revoked=0',[$id])->fetch(\PDO::FETCH_ASSOC);
        if(!$e)throw new ServiceError('ENTITLEMENT_EXPIRED',403);
        $known=$this->store->query('SELECT key_hash FROM devices WHERE entitlement_id=? AND device=?',[$id,$device])->fetchColumn();
        if($version!==null&&$known!==false&&!hash_equals($known,$keyHash))throw new ServiceError('DEVICE_ID_CONFLICT',409);
        $e['account_type']=$right['account_type'];$license=$this->crypto->license($e,$device,$pub,$this->crypto->open($right['email_cipher']),$now);
        $this->store->query('INSERT INTO devices VALUES(?,?,?,?,?) ON CONFLICT(entitlement_id,device) DO UPDATE SET key_hash=excluded.key_hash,recovered_at=excluded.recovered_at',[$id,$device,$keyHash,$now,$now]);
        if($passwordHash!==null)$this->store->query('UPDATE accounts SET password_hash=?,password_version=password_version+1 WHERE id=?',[$passwordHash,$right['account_id']]);return ['ok'=>true,'license'=>$license];
    }
    private function activeClaim(array $claim):array {
        $rows=$this->store->query('SELECT r.* FROM membership_rights r JOIN entitlements e ON e.account_id=r.account_id AND e.id=? JOIN devices d ON d.entitlement_id=e.id AND d.device=? WHERE r.account_id=? AND r.revoked=0 AND e.revoked=0 AND d.key_hash=?',[$claim['license_id'],$claim['device'],$claim['account_id'],$claim['key_hash']])->fetchAll(\PDO::FETCH_ASSOC);
        foreach($rows as $r)if('mb_'.hash('sha256',$r['member_id'])===$claim['license_id']&&(int)$r['starts_at']<=$this->clock->now()&&($r['expires_at']===null||(int)$r['expires_at']>$this->clock->now()))return $r;
        throw new ServiceError('ENTITLEMENT_EXPIRED',403);
    }
    public function challenge(array $input,string $ip):array {
        if(!$this->store->throttle($this->crypto->keyed('member-auth-ip',$ip),60,30))throw new ServiceError('RATE_LIMITED',429);
        if(!is_array($input['license']??null)||!is_string($input['public_key']??null))throw new ServiceError('INVALID_AUTH',401);
        $l=$this->crypto->verifyEnvelope($input['license']);if(($l['schema']??null)!==4||($l['channel']??null)!=='membership'||($l['product']??null)!==PRODUCT)throw new ServiceError('INVALID_AUTH',401);
        [$device,$pub,$hash]=$this->identity(['device_id'=>$l['device_id']??null,'public_key'=>$input['public_key']]);if(!hash_equals($l['public_key_sha256']??'',$hash))throw new ServiceError('INVALID_AUTH',401);
        $claim=['license_id'=>$l['license_id'],'account_id'=>$l['account_id'],'device'=>$device,'key_hash'=>$hash,'public_key'=>$pub];$this->activeClaim($claim);
        $id=bin2hex(random_bytes(24));$nonce=random_bytes(32);$now=$this->clock->now();
        $this->store->query('DELETE FROM membership_auth WHERE expires<=?',[$now]);$this->store->query('DELETE FROM membership_sessions WHERE expires<=?',[$now]);
        $this->store->query('INSERT INTO membership_auth VALUES(?,?,?,?)',[$id,$this->crypto->seal(encoded($claim)),$this->crypto->keyed('member-nonce',$nonce),$now+60]);
        return ['ok'=>true,'challenge_id'=>$id,'encrypted_nonce'=>$this->crypto->wrap($nonce,$pub,PRODUCT.'/membership-auth')];
    }
    public function authenticate(array $input,string $ip):array {
        if(!$this->store->throttle($this->crypto->keyed('member-auth-verify',$ip),60,60))throw new ServiceError('RATE_LIMITED',429);
        $id=$input['challenge_id']??null;$nonce=$input['nonce']??null;if(!is_string($id)||!preg_match('/^[a-f0-9]{48}$/D',$id)||!is_string($nonce))throw new ServiceError('INVALID_AUTH',401);
        $nonce=decode64($nonce,32);$this->store->begin();try{
            $row=$this->store->query('SELECT * FROM membership_auth WHERE id=?',[$id])->fetch(\PDO::FETCH_ASSOC);$this->store->query('DELETE FROM membership_auth WHERE id=?',[$id]);$this->store->commit();
            if(!$row||(int)$row['expires']<=$this->clock->now()||!hash_equals($row['nonce_hash'],$this->crypto->keyed('member-nonce',$nonce)))throw new ServiceError('INVALID_AUTH',401);
            $claim=json_decode($this->crypto->open($row['claim']),true,8,JSON_THROW_ON_ERROR);$this->store->begin();$right=$this->activeClaim($claim);
            $result=$this->allocate($right,$claim['device'],$claim['public_key'],$claim['key_hash'],null,null);$token=bin2hex(random_bytes(32));$expires=min($this->clock->now()+900,$right['expires_at']??PHP_INT_MAX);
            $this->store->query('INSERT INTO membership_sessions VALUES(?,?,?)',[$this->crypto->keyed('member-session',$token),$row['claim'],$expires]);$this->store->commit();return $result+['token'=>$token,'expires_at'=>utc($expires),'account_id'=>$claim['account_id']];
        }catch(\Throwable $e){$this->store->rollback();throw $e;}
    }
    public function session(string $token):array {
        if(!preg_match('/^[a-f0-9]{64}$/D',$token))throw new ServiceError('AUTH_REQUIRED',401);
        $row=$this->store->query('SELECT * FROM membership_sessions WHERE token_hash=?',[$this->crypto->keyed('member-session',$token)])->fetch(\PDO::FETCH_ASSOC);
        if(!$row||(int)$row['expires']<=$this->clock->now())throw new ServiceError('AUTH_REQUIRED',401);
        $claim=json_decode($this->crypto->open($row['claim']),true,8,JSON_THROW_ON_ERROR);$right=$this->activeClaim($claim);return ['account_id'=>$claim['account_id'],'group_id'=>$right['group_id'],'member_id'=>$right['member_id'],'account_type'=>$right['account_type']];
    }
}
