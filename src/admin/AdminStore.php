<?php
declare(strict_types=1);
namespace HorizonsAdmin;

final class AdminStore {
    public readonly \PDO $db;
    public function __construct(string $file,private readonly string $key) {
        if(strlen($key)!==32||is_link($file))throw new \RuntimeException('ADMIN_UNAVAILABLE');
        $this->db=new \PDO('sqlite:'.$file,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);chmod($file,0600);
        $this->db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS admin_orders(id TEXT PRIMARY KEY, request TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS admin_receipts(hash TEXT PRIMARY KEY,order_id TEXT UNIQUE NOT NULL); CREATE TABLE IF NOT EXISTS admin_events(id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,target TEXT NOT NULL,created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS admin_auth(id TEXT PRIMARY KEY,code_hash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL,used INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS admin_limits(bucket TEXT PRIMARY KEY,window INTEGER NOT NULL,n INTEGER NOT NULL)');
    }
    public function hash(string $s):string{return hash_hmac('sha256',$s,$this->key);}
    public function seal(array $a):string{$n=random_bytes(24);return base64_encode($n.sodium_crypto_secretbox(json_encode($a,JSON_THROW_ON_ERROR),$n,$this->key));}
    public function open(string $s):array{$v=base64_decode($s,true);if($v===false||strlen($v)<40)throw new \RuntimeException('ADMIN_UNAVAILABLE');$j=sodium_crypto_secretbox_open(substr($v,24),substr($v,0,24),$this->key);if($j===false)throw new \RuntimeException('ADMIN_UNAVAILABLE');return json_decode($j,true,16,JSON_THROW_ON_ERROR);}
    public function query(string $sql,array $params=[]):\PDOStatement{$q=$this->db->prepare($sql);$q->execute($params);return $q;}
    public function event(string $action,string $id):void{$this->query('INSERT INTO admin_events(action,target,created) VALUES(?,?,?)',[$action,$id,time()]);}
    public function atomic(callable $fn):mixed{$this->db->exec('BEGIN IMMEDIATE');try{$r=$fn();$this->db->exec('COMMIT');return $r;}catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}}
    public function limit(string $bucket,int $max,int $now):void{
        $hash=$this->hash($bucket);$w=intdiv($now,3600);$this->query('INSERT INTO admin_limits VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END,window=excluded.window',[$hash,$w]);
        if((int)$this->query('SELECT n FROM admin_limits WHERE bucket=?',[$hash])->fetchColumn()>$max)throw new \RuntimeException('RATE_LIMITED');
        $this->query('DELETE FROM admin_limits WHERE window<?',[$w-48]);
    }
    public function startLogin(string $session,string $ip,int $now,callable $send):string {
        $this->limit('login-ip:'.$ip,5,$now);$this->limit('owner-login',5,$now);
        $id=bin2hex(random_bytes(16));$code=str_pad((string)random_int(0,99999999),8,'0',STR_PAD_LEFT);
        $this->query('INSERT INTO admin_auth VALUES(?,?,?,0,0)',[$this->hash($session.':'.$id),$this->hash('code:'.$id.':'.$code),$now+600]);
        $this->query('DELETE FROM admin_auth WHERE expires<?',[$now-3600]);
        try{$send($code);}catch(\Throwable){$this->query('UPDATE admin_auth SET used=1 WHERE id=?',[$this->hash($session.':'.$id)]);throw new \RuntimeException('MAIL_UNAVAILABLE');}return $id;
    }
    public function verifyLogin(string $session,string $id,string $code,string $ip,int $now):void {
        $this->limit('verify-ip:'.$ip,30,$now);
        $ok=$this->atomic(function()use($session,$id,$code,$now){
            $hash=$this->hash($session.':'.$id);$r=$this->query('SELECT * FROM admin_auth WHERE id=?',[$hash])->fetch(\PDO::FETCH_ASSOC);
            if(!$r||$r['used']||$r['attempts']>=5||$r['expires']<=$now)return false;
            $this->query('UPDATE admin_auth SET attempts=attempts+1 WHERE id=?',[$hash]);
            if(!preg_match('/^[0-9]{8}$/D',$code)||!hash_equals($r['code_hash'],$this->hash('code:'.$id.':'.$code)))return false;
            $this->query("UPDATE admin_auth SET used=1,code_hash='' WHERE id=?",[$hash]);return true;
        });if(!$ok)throw new \RuntimeException('LOGIN_INVALID');$this->event('owner_login','owner');
    }
    public static function field(array $d,string $key,int $max=254):string{$v=$d[$key]??'';if(!is_string($v)||trim($v)===''||strlen($v)>$max||preg_match('//u',$v)!==1||preg_match('/[\x00-\x1f\x7f]/u',$v))throw new \RuntimeException('INVALID_INPUT');return trim($v);}
    public function create(array $d,array $catalog,\HorizonsCheckout\ExchangeRates $fx,int $now):array {
        $request=self::field($d,'request_id',32);if(!preg_match('/^[a-f0-9]{32}$/D',$request))throw new \RuntimeException('INVALID_INPUT');
        $product=self::field($d,'product',100);$offerId=self::field($d,'offer',100);$p=$catalog['products'][$product]??null;$offer=null;if(($p['available']??false)!==true||($p['fulfilment_adapter']??'')!=='membership-v1')throw new \RuntimeException('PRODUCT_UNAVAILABLE');foreach($p['offers'] as $o)if($o['id']===$offerId)$offer=$o;if(!$offer)throw new \RuntimeException('OFFER_UNAVAILABLE');
        $quote=$fx->verify(self::field($d,'quote_token',3000),$product,$offer,$now);
        $email=strtolower(self::field($d,'email'));if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$email!==strtolower(self::field($d,'email_confirm')))throw new \RuntimeException('EMAIL_MISMATCH');
        if(($d['customer_confirmed']??false)!==true)throw new \RuntimeException('CONSENT_REQUIRED');
        $buyer=['email'=>$email];foreach(['name'=>160,'phone'=>40,'country'=>100,'city'=>100,'address'=>500] as $k=>$max)$buyer[$k]=self::field($d,$k,$max);
        $buyer['billing']=$d['billing']??'individual';if(!in_array($buyer['billing'],['individual','company'],true))throw new \RuntimeException('INVALID_INPUT');
        if($buyer['billing']==='company')foreach(['company_name'=>200,'tax_id'=>48,'tax_office'=>100] as $k=>$max)$buyer[$k]=self::field($d,$k,$max);
        $payload=['product'=>$product,'offer'=>$offer,'buyer'=>$buyer,'quote'=>$quote,'customer_confirmed'=>true,'confirmation_kind'=>'owner_attestation','created'=>$now,'locale'=>in_array($d['locale']??'', ['en','ar','tr','fr','es','de','it','pt','nl','ru','uk','pl','cs','ro','hu','el','sv','da','no','fi','bg','sr','hr','he','fa','ur','hi','bn','id','ms','zh','ja'],true)?$d['locale']:'ar','bank_reference'=>null,'invoice'=>null,'purchase_id'=>null];
        // A retry must compare the same request data, independently of its clock.
        $fingerprint=$this->hash(json_encode([$product,$offer,$buyer,$quote,$payload['locale']],JSON_THROW_ON_ERROR));
        return $this->atomic(function()use($request,$fingerprint,$payload,$now){$old=$this->query('SELECT id,fingerprint FROM admin_orders WHERE request=?',[$request])->fetch(\PDO::FETCH_ASSOC);if($old){if(!hash_equals($old['fingerprint'],$fingerprint))throw new \RuntimeException('REQUEST_REUSED');return $this->order($old['id']);}
            $id='HZN-A-'.gmdate('Ymd',$now).'-'.strtoupper(bin2hex(random_bytes(8)));$this->query('INSERT INTO admin_orders VALUES(?,?,?,?,?,?)',[$id,$request,$fingerprint,'awaiting_payment',$this->seal($payload),$now]);$this->event('order_created',$id);return $this->order($id);});
    }
    public function order(string $id):array{$r=$this->query('SELECT * FROM admin_orders WHERE id=?',[$id])->fetch(\PDO::FETCH_ASSOC);if(!$r)throw new \RuntimeException('ORDER_NOT_FOUND');return ['id'=>$r['id'],'status'=>$r['status'],'created'=>(int)$r['created'],'data'=>$this->open($r['payload'])];}
    public function save(array $order):void{$this->query('UPDATE admin_orders SET payload=?,status=? WHERE id=?',[$this->seal($order['data']),$order['status'],$order['id']]);}
    public function payment(string $id,array $input):array {
        return $this->atomic(function()use($id,$input){$o=$this->order($id);$d=&$o['data'];$reference=self::field($input,'bank_reference',120);
            if(!preg_match('/^[A-Za-z0-9_-]{6,120}$/D',$reference)||($input['verified']??false)!==true)throw new \RuntimeException('PAYMENT_CONFIRM_REQUIRED');
            if(($input['currency']??null)!==$d['quote']['currency']||($input['amount_minor']??null)!==$d['quote']['amount_minor'])throw new \RuntimeException('AMOUNT_MISMATCH');
            if($o['status']!=='awaiting_payment'){if($d['bank_reference']!==$reference)throw new \RuntimeException('RECEIPT_REUSED');return $o;}
            $prior=$this->query('SELECT order_id FROM admin_receipts WHERE hash=?',[$this->hash($reference)])->fetchColumn();if($prior&&$prior!==$id)throw new \RuntimeException('RECEIPT_REUSED');
            $this->query('INSERT OR IGNORE INTO admin_receipts VALUES(?,?)',[$this->hash($reference),$id]);$d['bank_reference']=$reference;$d['paid_at']=time();$o['status']='paid';$this->save($o);$this->event('payment_verified',$id);return $o;
        });
    }
    public function invoice(string $id,string $number,bool $confirmed):array {
        if(!$confirmed||!preg_match('/^[A-Za-z0-9-]{6,64}$/D',$number))throw new \RuntimeException('INVOICE_REQUIRED');
        return $this->atomic(function()use($id,$number){$o=$this->order($id);if(!in_array($o['status'],['paid','invoice_recorded','fulfilled'],true))throw new \RuntimeException('PAYMENT_REQUIRED');if($o['data']['invoice']&&$o['data']['invoice']!==$number)throw new \RuntimeException('INVOICE_CONFLICT');$o['data']['invoice']=$number;if($o['status']!=='fulfilled')$o['status']='invoice_recorded';$this->save($o);$this->event('invoice_recorded',$id);return $o;});
    }
    public function listing(int $page=0,string $search=''):array {
        // Never search plaintext email in SQLite; decrypt bounded batches only.
        $page=max(0,min(10000,$page));$q=$this->query('SELECT id FROM admin_orders ORDER BY created DESC,id DESC LIMIT 31 OFFSET ?',[$page*30]);$ids=$q->fetchAll(\PDO::FETCH_COLUMN);$more=count($ids)>30;$rows=[];
        foreach(array_slice($ids,0,30) as $id){$o=$this->order($id);if($search!==''&&!str_contains(strtolower($id.' '.$o['data']['buyer']['email'].' '.$o['data']['buyer']['name']),strtolower($search)))continue;$rows[]=$o;}
        return ['orders'=>$rows,'more'=>$more,'page'=>$page];
    }
}
