<?php
declare(strict_types=1);
namespace HorizonsCheckout;

final class ManualOrders {
    private \PDO $db;
    public function __construct(string $file,private readonly string $key,private readonly array $catalog){
        if(strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES||is_link($file))throw new \RuntimeException('CONFIGURATION');
        $this->db=new \PDO('sqlite:'.$file,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);@chmod($file,0600);
        $this->db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS manual_orders(reference TEXT PRIMARY KEY,request_hash TEXT NOT NULL UNIQUE,input_hash TEXT NOT NULL,payload TEXT NOT NULL,owner_notified INTEGER NOT NULL DEFAULT 0,buyer_notified INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS manual_order_rate(bucket TEXT PRIMARY KEY,window INTEGER NOT NULL,n INTEGER NOT NULL)');
    }
    private function text(array $data,string $key,int $limit,bool $required=true):string{
        $v=$data[$key]??'';
        if(!is_string($v)||strlen($v)>$limit||preg_match('//u',$v)!==1||preg_match('/[\x00-\x1f\x7f]/u',$v)||($required&&trim($v)===''))throw new \RuntimeException('INVALID_BUYER');
        return trim($v);
    }
    public function create(array $input,string $client,string $ip,int $now):array{
        if(array_diff(array_keys($input),['request_id','product','offer','buyer','terms_accepted','privacy_read','locale']))throw new \RuntimeException('INVALID_REQUEST');
        $request=$input['request_id']??'';if(!is_string($request)||!preg_match('/^[a-f0-9]{32}$/D',$request))throw new \RuntimeException('INVALID_REQUEST');
        $product=$this->catalog['products'][$input['product']??'']??null;
        if(!$product||($product['available']??false)!==true||($product['sales_mode']??'')!=='manual_email')throw new \RuntimeException('PRODUCT_UNAVAILABLE');
        $offer=null;foreach($product['offers']??[] as $candidate)if(($candidate['id']??'')===($input['offer']??''))$offer=$candidate;
        if(!$offer)throw new \RuntimeException('OFFER_UNAVAILABLE');
        if(($input['terms_accepted']??false)!==true||($input['privacy_read']??false)!==true)throw new \RuntimeException('CONSENT_REQUIRED');
        $raw=$input['buyer']??null;if(!is_array($raw))throw new \RuntimeException('INVALID_BUYER');
        $allowed=['first_name','last_name','email','email_confirm','phone','country','city','billing','company_name','tax_id','tax_office'];
        if(array_diff(array_keys($raw),$allowed))throw new \RuntimeException('INVALID_BUYER');
        $buyer=[];foreach(['first_name'=>100,'last_name'=>100,'email'=>254,'email_confirm'=>254,'phone'=>40,'country'=>100,'city'=>100,'billing'=>10] as $k=>$max)$buyer[$k]=$this->text($raw,$k,$max);
        $buyer['email']=strtolower($buyer['email']);if(!filter_var($buyer['email'],FILTER_VALIDATE_EMAIL)||$buyer['email']!==strtolower($buyer['email_confirm']))throw new \RuntimeException('EMAIL_MISMATCH');unset($buyer['email_confirm']);
        if(!preg_match('/^\+?[0-9 ()-]{7,40}$/D',$buyer['phone']))throw new \RuntimeException('INVALID_BUYER');
        if(!in_array($buyer['billing'],['individual','company'],true))throw new \RuntimeException('INVALID_BUYER');
        if($buyer['billing']==='company')foreach(['company_name'=>200,'tax_id'=>64,'tax_office'=>100] as $k=>$max)$buyer[$k]=$this->text($raw,$k,$max);
        $locale=$input['locale']??'en';if(!is_string($locale)||!preg_match('/^[a-z]{2}$/D',$locale))$locale='en';
        $payload=['schema'=>1,'status'=>'manual_pending','payment_status'=>'not_collected','fulfilment_status'=>'manual','product'=>$product['id'],'product_name'=>$product['name'],'offer'=>$offer,'buyer'=>$buyer,'locale'=>$locale,'created_at'=>gmdate('c',$now)];
        $fingerprint=hash_hmac('sha256',json_encode([$product['id'],$offer,$buyer,$locale],JSON_THROW_ON_ERROR),$this->key);$requestHash=hash_hmac('sha256',$client.':'.$request,$this->key);$bucket=hash_hmac('sha256','ip:'.$ip,$this->key);$window=intdiv($now,3600);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $q=$this->db->prepare('SELECT reference,input_hash,owner_notified,buyer_notified FROM manual_orders WHERE request_hash=?');$q->execute([$requestHash]);$old=$q->fetch(\PDO::FETCH_ASSOC);
            if($old){if(!hash_equals($old['input_hash'],$fingerprint))throw new \RuntimeException('REQUEST_REUSED');$this->db->exec('COMMIT');return $this->response($old['reference'],$product,$offer,$buyer,$locale,(bool)$old['owner_notified'],(bool)$old['buyer_notified']);}
            $q=$this->db->prepare('INSERT INTO manual_order_rate VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END,window=excluded.window');$q->execute([$bucket,$window]);
            $q=$this->db->prepare('SELECT n FROM manual_order_rate WHERE bucket=?');$q->execute([$bucket]);if((int)$q->fetchColumn()>10)throw new \RuntimeException('RATE_LIMITED');
            $reference='HZN-M-'.gmdate('Ymd',$now).'-'.strtoupper(bin2hex(random_bytes(8)));$nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$cipher=base64_encode($nonce.sodium_crypto_secretbox(json_encode($payload,JSON_THROW_ON_ERROR),$nonce,$this->key));
            $q=$this->db->prepare('INSERT INTO manual_orders(reference,request_hash,input_hash,payload,created_at) VALUES(?,?,?,?,?)');$q->execute([$reference,$requestHash,$fingerprint,$cipher,$now]);
            $q=$this->db->prepare('DELETE FROM manual_orders WHERE created_at<?');$q->execute([$now-180*86400]);$this->db->exec('COMMIT');
            return $this->response($reference,$product,$offer,$buyer,$locale,false,false);
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    private function response(string $reference,array $product,array $offer,array $buyer,string $locale,bool $owner,bool $buyerMail):array{
        return ['ok'=>true,'reference'=>$reference,'product'=>$product,'offer'=>$offer,'buyer'=>$buyer,'locale'=>$locale,'owner_notified'=>$owner,'buyer_notified'=>$buyerMail];
    }
    public function mark(string $reference,string $field):void{
        if(!in_array($field,['owner_notified','buyer_notified'],true))throw new \RuntimeException('INVALID_REQUEST');
        $q=$this->db->prepare('UPDATE manual_orders SET '.$field.'=1 WHERE reference=?');$q->execute([$reference]);
    }
}
