<?php
declare(strict_types=1);
namespace HorizonsLearning;

const PRODUCT = 'horizons-arabic-level1';
const ISSUER = '3s4ebUqdPP3OchdsJMeQLuWIBI4pJuB0Lhu60U4jnEo=';
const LIMIT = 262144;
const LANGUAGES = ['en','ar','tr','fr','es','de','it','pt','nl','ru','uk','pl','cs','ro','hu','el','sv','da','no','fi','bg','sr','hr','he','fa','ur','hi','bn','id','ms','zh','ja'];
const CHAPTERS = ['alif','baa','taa','thaa','jiim','haa','khaa','daal','dhaal','raa','zaay','siin','shiin','saad','daad','taa_emphatic','dhaa_emphatic','ayn','ghayn','faa','qaaf','kaaf','laam','miim','nuun','haa_breath','waaw','yaa'];
const FORMS = ['isolated','initial','medial','final'];

final class ApiError extends \RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $status = 400, public readonly array $details = []) { parent::__construct($reason); }
}
function json(mixed $v): string { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); }
function utc(int $t): string { return gmdate('Y-m-d\TH:i:s\Z',$t); }
function b64(mixed $v, int $size = 0): string {
    if (!is_string($v) || strlen($v)>20000) throw new ApiError('INVALID_AUTH',401);
    $s = base64_decode($v,true);
    if ($s===false || base64_encode($s)!==$v || ($size && strlen($s)!==$size)) throw new ApiError('INVALID_AUTH',401);
    return $s;
}
function keys(array $v,array $required,array $optional=[]): void {
    foreach ($required as $key) if (!array_key_exists($key,$v)) throw new ApiError('INVALID_FIELD',400,['field'=>$key]);
    foreach ($v as $key=>$_) if (!in_array($key,$required,true) && !in_array($key,$optional,true)) throw new ApiError('INVALID_FIELD',400,['field'=>(string)$key]);
}
function id(mixed $v): string {
    if (!is_string($v) || !preg_match('/^[a-f0-9]{32}$/D',$v)) throw new ApiError('INVALID_FIELD',400,['field'=>'id']);
    return $v;
}
function dateValue(mixed $v): int {
    if (!is_string($v)) throw new ApiError('INVALID_AUTH',401);
    $d=\DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',$v,new \DateTimeZone('UTC'));
    if (!$d || $d->format('Y-m-d\TH:i:s\Z')!==$v) throw new ApiError('INVALID_AUTH',401);
    return $d->getTimestamp();
}

/** Independent connection: neither activation bootstrap nor migrations are called. */
final class Registration {
    private \PDO $db;
    public function __construct(string $path, private readonly string $issuer=ISSUER) {
        if (!is_file($path) || is_link($path)) throw new ApiError('SERVICE_UNAVAILABLE',503);
        $this->db=new \PDO('sqlite:'.$path,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::SQLITE_ATTR_OPEN_FLAGS=>\PDO::SQLITE_OPEN_READONLY]);
        $this->db->exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000');
    }
    private function one(string $sql,array $args): array|false { $s=$this->db->prepare($sql);$s->execute($args);return $s->fetch(\PDO::FETCH_ASSOC); }
    public function active(array $claim,int $now): array {
        $e=$this->one('SELECT * FROM entitlements WHERE id=?',[$claim['license_id']]);
        if (!$e || (int)$e['revoked']!==0 || (isset($e['starts_at']) && (int)$e['starts_at']>$now) || (isset($e['expires_at']) && (int)$e['expires_at']<=$now) || (isset($claim['expires']) && (int)$claim['expires']<=$now)) throw new ApiError('ENTITLEMENT_INACTIVE',403);
        $account=$e['account_id']??('acct_'.$e['email_hash']);
        if (!hash_equals($account,$claim['account_id'])) throw new ApiError('INVALID_AUTH',401);
        $d=$this->one('SELECT key_hash FROM devices WHERE entitlement_id=? AND device=?',[$claim['license_id'],$claim['device_id']]);
        if (!$d || !hash_equals($d['key_hash'],$claim['key_hash'])) throw new ApiError('DEVICE_REVOKED',403);
        if (($e['channel']??'direct')==='direct' && isset($e['account_id'])) {
            $d=$this->one('SELECT key_hash FROM account_devices WHERE account_id=? AND device=?',[$account,$claim['device_id']]);
            if (!$d || !hash_equals($d['key_hash'],$claim['key_hash'])) throw new ApiError('DEVICE_REVOKED',403);
        }
        return $claim;
    }
    public function verify(mixed $envelope,mixed $publicKey,int $now): array {
        if (!is_array($envelope)) throw new ApiError('INVALID_AUTH',401);
        keys($envelope,['payload','signature']);
        $raw=b64($envelope['payload']);$signature=b64($envelope['signature'],64);
        if (!sodium_crypto_sign_verify_detached($signature,$raw,b64($this->issuer,32))) throw new ApiError('INVALID_AUTH',401);
        try {$l=json_decode($raw,true,8,JSON_THROW_ON_ERROR);} catch(\Throwable $e) {throw new ApiError('INVALID_AUTH',401);}
        if (!is_array($l) || !in_array($l['schema']??null,[2,3],true) || ($l['product']??null)!==PRODUCT) throw new ApiError('INVALID_AUTH',401);
        foreach (['license_id','device_id','public_key_sha256'] as $f) if (!is_string($l[$f]??null)) throw new ApiError('INVALID_AUTH',401);
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/D',$l['license_id']) || !preg_match('/^[a-f0-9]{64}$/D',$l['device_id']) || !preg_match('/^[a-f0-9]{64}$/D',$l['public_key_sha256'])) throw new ApiError('INVALID_AUTH',401);
        $issued=dateValue($l['issued_at']??null);
        if ($issued>$now+300) throw new ApiError('INVALID_AUTH',401);
        $der=b64($publicKey);
        if (strlen($der)>2048 || !hash_equals($l['public_key_sha256'],hash('sha256',$der))) throw new ApiError('INVALID_AUTH',401);
        $pub=openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der),64,"\n")."-----END PUBLIC KEY-----\n");
        $details=$pub?openssl_pkey_get_details($pub):false;
        if (!$details || $details['type']!==OPENSSL_KEYTYPE_RSA || $details['bits']<2048 || $details['bits']>4096 || ($details['rsa']['e']??'')!=="\x01\x00\x01" || preg_replace('/-----[^-]+-----|\s/','',$details['key'])!==$publicKey) throw new ApiError('INVALID_AUTH',401);
        $expires=null;
        if ($l['schema']===3) {
            if (!is_string($l['account_id']??null) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/D',$l['account_id']) || dateValue($l['starts_at']??null)>$now) throw new ApiError('INVALID_AUTH',401);
            if (($l['expires_at']??null)!==null) $expires=dateValue($l['expires_at']);
            $account=$l['account_id'];
        } else {
            $e=$this->one('SELECT * FROM entitlements WHERE id=?',[$l['license_id']]);
            if (!$e) throw new ApiError('INVALID_AUTH',401);
            $account=$e['account_id']??('acct_'.$e['email_hash']);
        }
        return [$this->active(['account_id'=>$account,'license_id'=>$l['license_id'],'device_id'=>$l['device_id'],'key_hash'=>$l['public_key_sha256'],'expires'=>$expires],$now),$pub,(int)ceil($details['bits']/8)];
    }
}

/** RFC 8017 OAEP with SHA-256, since PHP 8.2's built-in OAEP uses SHA-1. */
function wrapNonce(string $nonce,\OpenSSLAsymmetricKey $key,int $size): string {
    $mgf=function(string $seed,int $length):string {$out='';for($i=0;strlen($out)<$length;$i++)$out.=hash('sha256',$seed.pack('N',$i),true);return substr($out,0,$length);};
    $db=hash('sha256',PRODUCT.'/progress-auth',true).str_repeat("\0",$size-strlen($nonce)-66)."\x01".$nonce;
    $seed=random_bytes(32);$masked=$db^$mgf($seed,$size-33);$encoded="\0".($seed^$mgf($masked,32)).$masked;
    if (!openssl_public_encrypt($encoded,$out,$key,OPENSSL_NO_PADDING)) throw new ApiError('SERVICE_UNAVAILABLE',503);
    return base64_encode($out);
}

function validateDocument(array $input): array {
    foreach (['nickname','settings','progress'] as $field) if (!array_key_exists($field,$input)) throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
    $nickname=$input['nickname'];$settings=$input['settings'];$p=$input['progress'];
    if (!is_string($nickname) || preg_match('//u',$nickname)!==1 || preg_match('/[\x00-\x1f\x7f]/u',$nickname) || preg_match_all('/./us',$nickname)>80 || !is_array($settings) || !is_array($p)) throw new ApiError('INVALID_FIELD',400,['field'=>'profile']);
    keys($settings,['locale','meaningLocale','typography']);
    $typography=$settings['typography'];
    if (!in_array($settings['locale'],LANGUAGES,true) || !in_array($settings['meaningLocale'],['ar','en','tr','fr','es'],true) || !is_array($typography)) throw new ApiError('INVALID_FIELD',400,['field'=>'settings']);
    keys($typography,['schemaVersion','font','size']);
    if ($typography['schemaVersion']!==1 || !in_array($typography['font'],['noto-naskh','amiri','scheherazade','noto-sans','noto-kufi'],true) || !is_int($typography['size']) || $typography['size']<0 || $typography['size']>4) throw new ApiError('INVALID_FIELD',400,['field'=>'typography']);
    keys($p,['schemaVersion','bookId','contentVersion','audioRevision','locale','course','chapter','tab','word','quiz','quizMode','story','frame','form','alphabetMode','letter','meaning','guide','heard','attempts','written','bookmarks']);
    if ($p['schemaVersion']!=='3.0' || $p['bookId']!=='horizons-arabic-complete' || $p['contentVersion']!=='0.3.0' || !is_string($p['audioRevision']) || !preg_match('/^[a-zA-Z0-9._-]{1,80}$/D',$p['audioRevision']) || !in_array($p['locale'],LANGUAGES,true) || !in_array($p['course'],['alphabet','catalog','lesson'],true) || !in_array($p['chapter'],CHAPTERS,true) || !in_array($p['alphabetMode'],['explore','quiz','match'],true) || !is_int($p['letter']) || $p['letter']<0 || $p['letter']>27 || !is_bool($p['meaning']) || !is_bool($p['guide'])) throw new ApiError('INVALID_FIELD',400,['field'=>'progress']);
    $position=function(array $v):void {
        if (!in_array($v['tab']??null,['words','quiz','stories','write'],true) || !in_array($v['quizMode']??null,['word','sentence'],true) || !in_array($v['form']??null,FORMS,true)) throw new ApiError('INVALID_FIELD',400,['field'=>'position']);
        foreach (['word'=>20,'quiz'=>20,'story'=>2,'frame'=>4] as $key=>$max) if (!is_int($v[$key]??null) || $v[$key]<0 || $v[$key]>=$max) throw new ApiError('INVALID_FIELD',400,['field'=>$key]);
    };
    $position($p);
    if (!is_array($p['bookmarks']) || count($p['bookmarks'])>28) throw new ApiError('INVALID_FIELD',400,['field'=>'bookmarks']);
    foreach ($p['bookmarks'] as $chapter=>$bookmark) {
        if (!in_array($chapter,CHAPTERS,true) || !is_array($bookmark)) throw new ApiError('INVALID_FIELD',400,['field'=>'bookmarks']);
        keys($bookmark,['tab','word','quiz','quizMode','story','frame','form']);$position($bookmark);
    }
    foreach (['heard','attempts','written'] as $field) {
        if (!is_array($p[$field]) || count($p[$field])>($field==='written'?112:2999)) throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
        foreach ($p[$field] as $key=>$value) {
            if (!is_string($key) || strlen($key)>96) throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
            if ($field==='heard' && (!preg_match('/^(alphabet\.|word\.|sentence\.|story\.)[a-z0-9_-]+$/D',$key) || !is_bool($value))) throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
            if ($field==='written') { $parts=explode(':',$key);if(count($parts)!==2 || !in_array($parts[0],CHAPTERS,true) || !in_array($parts[1],FORMS,true) || !is_bool($value))throw new ApiError('INVALID_FIELD',400,['field'=>$field]); }
            if ($field==='attempts') {
                if (!preg_match('/^(alpha-|match-|word-|sentence-|story-)[a-z0-9_.-]+$/D',$key) || !is_array($value))throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
                keys($value,['completed','count']);if(!is_bool($value['completed']) || !is_int($value['count']) || $value['count']<0 || $value['count']>=100000)throw new ApiError('INVALID_FIELD',400,['field'=>$field]);
            }
        }
    }
    // Empty JSON maps must round-trip as {}, never [] (the browser validates objects).
    foreach (['heard','attempts','written','bookmarks'] as $key) $p[$key]=(object)$p[$key];
    return ['nickname'=>trim($nickname),'settings'=>$settings,'progress'=>$p];
}

final class Service {
    private \PDO $db;
    public function __construct(string $path,private readonly string $key,private readonly Registration $registration,private readonly \Closure $clock) {
        if (strlen($key)!==32 || is_link($path)) throw new ApiError('SERVICE_UNAVAILABLE',503);
        $this->db=new \PDO('sqlite:'.$path,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
        if (!chmod($path,0600))throw new ApiError('SERVICE_UNAVAILABLE',503);
        $this->db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;');
        $this->db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS metadata(name TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,claim TEXT NOT NULL,nonce_hash TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,claim TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rates(bucket TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(bucket,window));
CREATE TABLE IF NOT EXISTS profiles(account TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,deleted INTEGER,payload TEXT,consent INTEGER NOT NULL,PRIMARY KEY(account,id));
CREATE TABLE IF NOT EXISTS operations(account TEXT NOT NULL,id TEXT NOT NULL,profile TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(account,id));
CREATE INDEX IF NOT EXISTS challenges_expiry ON challenges(expires);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE INDEX IF NOT EXISTS rates_expiry ON rates(window);
CREATE INDEX IF NOT EXISTS operations_expiry ON operations(created);
SQL);
        $verifier=$this->hash('key','horizons-learning-v1');
        $this->query('INSERT OR IGNORE INTO metadata(name,value) VALUES(?,?)',['key_verifier',$verifier]);
        if (!hash_equals((string)$this->query('SELECT value FROM metadata WHERE name=?',['key_verifier'])->fetchColumn(),$verifier)) throw new ApiError('SERVICE_UNAVAILABLE',503);
    }
    private function query(string $sql,array $args=[]):\PDOStatement {$s=$this->db->prepare($sql);$s->execute($args);return $s;}
    private function hash(string $domain,string $value):string{return hash_hmac('sha256',$domain."\0".$value,$this->key);}
    private function seal(array $value):string {$nonce=random_bytes(24);return base64_encode($nonce.sodium_crypto_secretbox(json($value),$nonce,$this->key));}
    private function open(string $value):array {$raw=base64_decode($value,true);if($raw===false || strlen($raw)<40)throw new ApiError('SERVICE_UNAVAILABLE',503);$out=sodium_crypto_secretbox_open(substr($raw,24),substr($raw,0,24),$this->key);if($out===false)throw new ApiError('SERVICE_UNAVAILABLE',503);return json_decode($out,true,24,JSON_THROW_ON_ERROR);}
    private function atomic(\Closure $fn):array {
        $this->db->exec('BEGIN IMMEDIATE');try{$v=$fn();$this->db->exec('COMMIT');return $v;}catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    private function rate(string $bucket,int $max,int $seconds=60):void {
        $now=($this->clock)();$window=intdiv($now,$seconds)*$seconds;$bucket=$this->hash('rate',$bucket);
        $this->query('INSERT INTO rates VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET count=count+1',[$bucket,$window]);
        if ((int)$this->query('SELECT count FROM rates WHERE bucket=? AND window=?',[$bucket,$window])->fetchColumn()>$max)throw new ApiError('RATE_LIMITED',429);
    }
    public function dispatch(string $action,array $input,string $token,string $ip):array {
        $now=($this->clock)();
        if (strlen(json($input))>LIMIT) throw new ApiError('PAYLOAD_TOO_LARGE',413);
        $this->rate('ip:'.$ip,240);
        // Expired credentials and operation results contain no lasting learning history.
        $this->query('DELETE FROM challenges WHERE expires<?',[$now]);$this->query('DELETE FROM sessions WHERE expires<?',[$now]);$this->query('DELETE FROM rates WHERE window<?',[$now-7200]);$this->query('DELETE FROM operations WHERE created<?',[$now-30*86400]);
        if ($action==='auth-challenge') {
            keys($input,['license','public_key']);$this->rate('auth:'.$ip,30);
            [$claim,$pub,$size]=$this->registration->verify($input['license'],$input['public_key'],$now);
            $this->rate('device:'.$claim['device_id'],12);
            $nonce=random_bytes(32);$challenge=bin2hex(random_bytes(16));
            $this->query('INSERT INTO challenges VALUES(?,?,?,?)',[$challenge,$this->seal($claim),$this->hash('nonce',$nonce),$now+60]);
            return ['ok'=>true,'account_id'=>$claim['account_id'],'challenge_id'=>$challenge,'encrypted_nonce'=>wrapNonce($nonce,$pub,$size),'expires_at'=>utc($now+60)];
        }
        if ($action==='auth-verify') {
            keys($input,['challenge_id','nonce']);$challenge=id($input['challenge_id']);$nonce=b64($input['nonce'],32);$this->rate('verify:'.$ip,60);
            // Consume even incorrect responses, independently of later authentication errors.
            $result=$this->atomic(function()use($challenge):array {$row=$this->query('SELECT * FROM challenges WHERE id=?',[$challenge])->fetch(\PDO::FETCH_ASSOC);$this->query('DELETE FROM challenges WHERE id=?',[$challenge]);return $row?:[];});
            if (!$result || (int)$result['expires']<=$now || !hash_equals($result['nonce_hash'],$this->hash('nonce',$nonce)))throw new ApiError('INVALID_AUTH',401);
            $claim=$this->registration->active($this->open($result['claim']),$now);$token=bin2hex(random_bytes(32));$expires=min($now+900,$claim['expires']??PHP_INT_MAX);
            $this->query('INSERT INTO sessions VALUES(?,?,?)',[$this->hash('token',$token),$this->seal($claim),$expires]);
            return ['ok'=>true,'account_id'=>$claim['account_id'],'token'=>$token,'expires_at'=>utc($expires)];
        }
        if (!preg_match('/^[a-f0-9]{64}$/D',$token))throw new ApiError('AUTH_REQUIRED',401);
        $session=$this->query('SELECT * FROM sessions WHERE token_hash=?',[$this->hash('token',$token)])->fetch(\PDO::FETCH_ASSOC);
        if (!$session || (int)$session['expires']<=$now)throw new ApiError('AUTH_REQUIRED',401);
        $claim=$this->registration->active($this->open($session['claim']),$now);$account=$this->hash('account',$claim['account_id']);$this->rate('account:'.$account,180);
        $base=['ok'=>true,'account_id'=>$claim['account_id']];
        if ($action==='list') {
            keys($input,[],['cursor']);$cursor=$input['cursor']??'';if($cursor!=='')id($cursor);
            $rows=$this->query('SELECT id,revision,deleted FROM profiles WHERE account=? AND id>? ORDER BY id LIMIT 51',[$account,$cursor])->fetchAll(\PDO::FETCH_ASSOC);$more=count($rows)>50;if($more)array_pop($rows);
            $profiles=array_map(function($r){$v=['id'=>$r['id'],'revision'=>(int)$r['revision']];if($r['deleted']!==null)$v['deleted_at']=utc((int)$r['deleted']);return $v;},$rows);
            return $base+['profiles'=>$profiles,'cursor'=>$more?end($rows)['id']:null];
        }
        if ($action==='get') {keys($input,['id']);$row=$this->row($account,id($input['id']));if(!$row)throw new ApiError('PROFILE_NOT_FOUND',404);return $base+['profile'=>$this->profile($row)];}
        if (!in_array($action,['put','delete'],true))throw new ApiError('NOT_FOUND',404);
        keys($input,$action==='put'?['operation_id','id','base_revision','nickname','settings','progress','consent']:['operation_id','id','base_revision']);
        $profileID=id($input['id']);$operation=id($input['operation_id']);$revision=$input['base_revision'];
        if (!is_int($revision) || $revision<0 || $revision>9007199254740990)throw new ApiError('INVALID_FIELD',400,['field'=>'base_revision']);
        if ($action==='put' && $input['consent']!==true)throw new ApiError('CONSENT_REQUIRED',400);
        $doc=$action==='put'?validateDocument($input):null;
        $requestHash=hash('sha256',json([$action,$input]));
        return $this->atomic(function()use($base,$account,$profileID,$operation,$revision,$doc,$action,$requestHash,$now):array {
            $old=$this->query('SELECT * FROM operations WHERE account=? AND id=?',[$account,$operation])->fetch(\PDO::FETCH_ASSOC);
            if($old){if(!hash_equals($old['request_hash'],$requestHash))throw new ApiError('OPERATION_REUSED',409);$ack=$this->open($old['response']);$current=$this->row($account,$old['profile']);if(!$current)throw new ApiError('SERVICE_UNAVAILABLE',503);return $base+['profile'=>$this->profile($current),'replayed'=>true,'acknowledged_revision'=>$ack['revision']];}
            $row=$this->row($account,$profileID);
            if (($row?(int)$row['revision']:0)!==$revision || ($row && $row['deleted']!==null))throw new ApiError('REVISION_CONFLICT',409,['profile'=>$row?$this->profile($row):null]);
            if(!$row && $action==='delete')throw new ApiError('PROFILE_NOT_FOUND',404);
            if (!$row && (int)$this->query('SELECT COUNT(*) FROM profiles WHERE account=?',[$account])->fetchColumn()>=1000)throw new ApiError('PROFILE_LIMIT',507);
            if (!$row && (int)$this->query('SELECT COUNT(*) FROM profiles WHERE account=? AND deleted IS NULL',[$account])->fetchColumn()>=50)throw new ApiError('PROFILE_LIMIT',507);
            $deleted=$action==='delete'?$now:null;$payload=$doc?$this->seal($doc):null;
            $this->query('INSERT INTO profiles(account,id,revision,created,updated,deleted,payload,consent) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account,id) DO UPDATE SET revision=excluded.revision,updated=excluded.updated,deleted=excluded.deleted,payload=excluded.payload',[$account,$profileID,$revision+1,$row?(int)$row['created']:$now,$now,$deleted,$payload,$now]);
            $response=['profile'=>$this->profile($this->row($account,$profileID))];
            // Keep only the acknowledgement revision. Historical learning snapshots
            // must not accumulate or survive deletion in an idempotency cache.
            $this->query('INSERT INTO operations VALUES(?,?,?,?,?,?)',[$account,$operation,$profileID,$requestHash,$this->seal(['revision'=>$revision+1]),$now]);
            $this->query('DELETE FROM operations WHERE account=? AND id IN (SELECT id FROM operations WHERE account=? ORDER BY created DESC,id DESC LIMIT -1 OFFSET 5000)',[$account,$account]);
            return $base+$response;
        });
    }
    private function row(string $account,string $id):array|false {return $this->query('SELECT * FROM profiles WHERE account=? AND id=?',[$account,$id])->fetch(\PDO::FETCH_ASSOC);}
    private function profile(array $row):array {
        $p=['id'=>$row['id'],'revision'=>(int)$row['revision'],'created_at'=>utc((int)$row['created']),'updated_at'=>utc((int)$row['updated'])];
        if($row['deleted']!==null)return $p+['deleted_at'=>utc((int)$row['deleted'])];
        $doc=$this->open($row['payload']);foreach(['heard','attempts','written','bookmarks'] as $key)$doc['progress'][$key]=(object)$doc['progress'][$key];
        return $p+$doc;
    }
}
