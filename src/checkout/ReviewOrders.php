<?php
declare(strict_types=1);
namespace HorizonsCheckout;

/** Separate, non-payable bank-review records. Never imports the licence issuer. */
final class ReviewOrders {
    private \PDO $db;
    public function __construct(string $file, private readonly string $key, private readonly array $catalog, private readonly ?ExchangeRates $fx=null) {
        if (strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES || is_link($file)) throw new \RuntimeException('CONFIGURATION');
        $this->db=new \PDO('sqlite:'.$file,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
        chmod($file,0600);
        $this->db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS review_orders(reference TEXT PRIMARY KEY,request_hash TEXT NOT NULL UNIQUE,input_hash TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS review_rate(bucket TEXT PRIMARY KEY,window INTEGER NOT NULL,n INTEGER NOT NULL)');
    }
    private function text(array $data,string $key,int $limit,bool $required=true):string {
        $v=$data[$key]??'';
        if(!is_string($v)||strlen($v)>$limit||preg_match('//u',$v)!==1||preg_match('/[\x00-\x1f\x7f]/u',$v)||($required&&trim($v)===''))throw new \RuntimeException('INVALID_BUYER');
        return trim($v);
    }
    public function create(array $input,string $client,string $ip,int $now):array {
        if(($this->catalog['mode']??'')!=='bank_review'||($this->catalog['collection_enabled']??true)!==false)throw new \RuntimeException('REVIEW_UNAVAILABLE');
        if(array_diff(array_keys($input),['request_id','product','offer','method','buyer','terms_accepted','privacy_read','permanent_acknowledged','policy_version','locale','quote_token']))throw new \RuntimeException('INVALID_REQUEST');
        $request=$input['request_id']??'';
        if(!is_string($request)||!preg_match('/^[a-f0-9]{32}$/D',$request)||!is_string($input['product']??null)||!is_string($input['offer']??null))throw new \RuntimeException('INVALID_REQUEST');
        $product=$this->catalog['products'][$input['product']]??null;
        if(!$product||($product['available']??false)!==true)throw new \RuntimeException('PRODUCT_UNAVAILABLE');
        $offer=null;foreach($product['offers'] as $candidate)if($candidate['id']===$input['offer'])$offer=$candidate;
        if(!$offer)throw new \RuntimeException('OFFER_UNAVAILABLE');
        $quote=$this->fx?->verify(is_string($input['quote_token']??null)?$input['quote_token']:'',$product['id'],$offer,$now);
        if(($input['method']??'')!=='transfer')throw new \RuntimeException('CARD_NOT_ENABLED');
        if(($input['terms_accepted']??false)!==true||($input['privacy_read']??false)!==true||($input['policy_version']??'')!==$this->catalog['policy_version'])throw new \RuntimeException('CONSENT_REQUIRED');
        if(in_array($offer['account_type']??'', ['individual','family'],true)&&($input['permanent_acknowledged']??false)!==true)throw new \RuntimeException('CONSENT_REQUIRED');
        $raw=$input['buyer']??null;
        $allowed=['first_name','last_name','email','email_confirm','phone','country_code','country','city','address','postal','billing','company_name','tax_id','tax_office'];
        if(!is_array($raw)||array_diff(array_keys($raw),$allowed))throw new \RuntimeException('INVALID_BUYER');
        $buyer=[];
        foreach(['first_name'=>100,'last_name'=>100,'email'=>254,'email_confirm'=>254,'phone'=>40,'country_code'=>2,'country'=>100,'city'=>100,'address'=>500,'billing'=>10] as $key=>$limit)$buyer[$key]=$this->text($raw,$key,$limit);
        $buyer['postal']=$this->text($raw,'postal',32,false);
        $buyer['email']=strtolower($buyer['email']);
        if(!filter_var($buyer['email'],FILTER_VALIDATE_EMAIL)||$buyer['email']!==strtolower($buyer['email_confirm']))throw new \RuntimeException('EMAIL_MISMATCH');
        unset($buyer['email_confirm']);
        if($buyer['country_code']!=='TR')throw new \RuntimeException('TRANSFER_TURKEY_ONLY');
        if(!preg_match('/^\+?[0-9 ()-]{7,40}$/D',$buyer['phone']))throw new \RuntimeException('INVALID_BUYER');
        if(!in_array($buyer['billing'],['individual','company'],true))throw new \RuntimeException('INVALID_BUYER');
        if($buyer['billing']==='company')foreach(['company_name'=>200,'tax_id'=>48,'tax_office'=>100] as $key=>$limit)$buyer[$key]=$this->text($raw,$key,$limit);
        if($buyer['billing']==='company'&&!preg_match('/^[0-9]{10,11}$/D',$buyer['tax_id']))throw new \RuntimeException('INVALID_BUYER');
        $locale=$input['locale']??'en';if(!is_string($locale)||!preg_match('/^[a-z]{2}$/D',$locale))throw new \RuntimeException('INVALID_REQUEST');
        $payload=['schema'=>1,'mode'=>'bank_review','payment_status'=>'unpaid','status'=>'review_only','product'=>$product['id'],'product_name'=>$product['name'],'offer'=>$offer,'buyer'=>$buyer,'method'=>'transfer','locale'=>$locale,'policy_version'=>$this->catalog['policy_version'],'terms_accepted'=>true,'privacy_read'=>true,'permanent_acknowledged'=>$input['permanent_acknowledged']??false,'created_at'=>gmdate('c',$now),'fulfilment_status'=>'not_started','invoice_status'=>'not_issued'];
        if($quote)$payload['quote']=$quote;
        $fingerprint=hash_hmac('sha256',json_encode([$product['id'],$offer,$buyer,$locale,$payload['policy_version'],$quote],JSON_THROW_ON_ERROR),$this->key);
        $requestHash=hash_hmac('sha256',$client.':'.$request,$this->key);
        $bucket=hash_hmac('sha256','ip:'.$ip,$this->key);$window=intdiv($now,3600);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $q=$this->db->prepare('SELECT reference,input_hash FROM review_orders WHERE request_hash=?');$q->execute([$requestHash]);$old=$q->fetch(\PDO::FETCH_ASSOC);
            if($old){if(!hash_equals($old['input_hash'],$fingerprint))throw new \RuntimeException('REQUEST_REUSED');$this->db->exec('COMMIT');return $this->response($old['reference'],$offer);}
            $q=$this->db->prepare('INSERT INTO review_rate VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END,window=excluded.window');$q->execute([$bucket,$window]);
            $q=$this->db->prepare('SELECT n FROM review_rate WHERE bucket=?');$q->execute([$bucket]);if((int)$q->fetchColumn()>10)throw new \RuntimeException('RATE_LIMITED');
            $reference='HZN-R-'.gmdate('Ymd',$now).'-'.strtoupper(bin2hex(random_bytes(10)));
            $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$cipher=base64_encode($nonce.sodium_crypto_secretbox(json_encode($payload,JSON_THROW_ON_ERROR),$nonce,$this->key));
            $q=$this->db->prepare('INSERT INTO review_orders VALUES(?,?,?,?,?)');$q->execute([$reference,$requestHash,$fingerprint,$cipher,$now]);
            $q=$this->db->prepare('DELETE FROM review_orders WHERE created_at<?');$q->execute([$now-30*86400]);
            $q=$this->db->prepare('DELETE FROM review_rate WHERE window<?');$q->execute([$window-24]);
            $this->db->exec('COMMIT');return $this->response($reference,$offer);
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    private function response(string $reference,array $offer):array {
        return ['ok'=>true,'reference'=>$reference,'mode'=>'bank_review','status'=>'review_only','payment_status'=>'unpaid','amount_minor'=>$offer['price_minor'],'currency'=>$offer['currency'],'collection_enabled'=>false,'invoice_status'=>'not_issued','fulfilment_status'=>'not_started'];
    }
}
