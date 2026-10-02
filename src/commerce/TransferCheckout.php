<?php
declare(strict_types=1);
namespace HorizonsCommerce;
require_once __DIR__.'/PurchaseLedger.php';
require_once __DIR__.'/MembershipLedger.php';
/** USD transfers; bank credit confirmation is an owner-only CLI action. */
final class TransferCheckout {
    private \PDO $db;
    public function __construct(string $file,string $documentRoot,private readonly PurchaseLedger $purchases,private readonly string $key,private readonly ?MembershipLedger $members=null){
        $dir=realpath(dirname($file));$web=realpath($documentRoot);
        if(strlen($key)!==32||!$dir||!$web||$dir===$web||str_starts_with($dir,$web.DIRECTORY_SEPARATOR)||is_link($file))throw new \RuntimeException('PRIVATE_DATABASE_REQUIRED');
        $this->db=new \PDO('sqlite:'.$file,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);chmod($file,0600);
        $this->db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS transfer_orders(request_hash TEXT PRIMARY KEY,input_hash TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE,billing_cipher TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS transfer_receipts(bank_reference TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,currency TEXT NOT NULL,amount_minor INTEGER NOT NULL,confirmed_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS transfer_rates(bucket TEXT NOT NULL,window INTEGER NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(bucket,window)); CREATE TABLE IF NOT EXISTS transfer_meta(id INTEGER PRIMARY KEY,key_hash TEXT NOT NULL)');
        $hash=hash_hmac('sha256','transfer-checkout-key',$key);$this->query('INSERT OR IGNORE INTO transfer_meta VALUES(1,?)',[$hash]);if(!hash_equals($hash,$this->query('SELECT key_hash FROM transfer_meta WHERE id=1')->fetchColumn()))throw new \RuntimeException('TRANSFER_KEY_CHANGED');
    }
    private function query(string $sql,array $args=[]):\PDOStatement{$q=$this->db->prepare($sql);$q->execute($args);return $q;}
    private function seal(array $value):string{$nonce=random_bytes(24);return base64_encode($nonce.sodium_crypto_secretbox(json_encode($value,JSON_THROW_ON_ERROR),$nonce,$this->key));}
    private function field(array $v,string $name,int $max,bool $required=true):string{$s=$v[$name]??'';if(!is_string($s)||strlen($s)>$max||preg_match('//u',$s)!==1||preg_match('/[\x00-\x1f\x7f]/u',$s)||($required&&trim($s)===''))throw new \RuntimeException('BILLING_INVALID');return trim($s);}
    public function create(array $input,string $ip,int $now):array {
        $request=$input['request_id']??null;if(!is_string($request)||!preg_match('/^[a-f0-9]{32}$/D',$request))throw new \RuntimeException('INVALID_REQUEST');
        $account=$input['account_type']??'';$plan=$input['plan']??'';if(!is_string($account)||!is_string($plan)||!in_array($account,['individual','family','institution'],true))throw new \RuntimeException('ACCOUNT_TYPE_INVALID');
        if(($input['terms_accepted']??false)!==true||($account!=='institution'&&($input['permanent_acknowledged']??false)!==true))throw new \RuntimeException('CONSENT_REQUIRED');
        $buyer=$input['buyer']??null;if(!is_array($buyer))throw new \RuntimeException('BILLING_INVALID');$email=strtolower($this->field($buyer,'email',254));$confirmation=strtolower($this->field($buyer,'email_confirm',254));
        if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$email!==$confirmation)throw new \RuntimeException('EMAIL_CONFIRMATION_REQUIRED');
        $billing=['email'=>$email];foreach(['name'=>160,'country'=>100,'city'=>100,'address'=>500] as $f=>$max)$billing[$f]=$this->field($buyer,$f,$max);
        $billing['postal']=$this->field($buyer,'postal',30,false);$billing['billing']=$this->field($buyer,'billing',10);if(!in_array($billing['billing'],['individual','company'],true))throw new \RuntimeException('BILLING_INVALID');
        if($billing['billing']==='company'){$billing['company_name']=$this->field($buyer,'company_name',200);$billing['tax_id']=$this->field($buyer,'tax_id',64,false);}
        $billing['terms_version']='2026-10-01';$billing['permanent_acknowledged']=$account!=='institution';
        $hash=hash_hmac('sha256','request:'.$request,$this->key);$fingerprint=hash_hmac('sha256',json_encode([$account,$plan,$billing],JSON_THROW_ON_ERROR),$this->key);$bucket=hash_hmac('sha256','ip:'.$ip,$this->key);$window=intdiv($now,3600);
        $this->query('DELETE FROM transfer_rates WHERE window<?',[$window-24]);$this->query('INSERT INTO transfer_rates VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET n=n+1',[$bucket,$window]);if((int)$this->query('SELECT n FROM transfer_rates WHERE bucket=? AND window=?',[$bucket,$window])->fetchColumn()>20)throw new \RuntimeException('RATE_LIMITED');
        $this->db->exec('BEGIN IMMEDIATE');try{
            $prior=$this->query('SELECT * FROM transfer_orders WHERE request_hash=?',[$hash])->fetch(\PDO::FETCH_ASSOC);
            if($prior){if(!hash_equals($prior['input_hash'],$fingerprint))throw new \RuntimeException('REQUEST_REUSED');$order=$this->purchases->order($prior['order_id']);}
            else{$this->members?->assertPurchaseAllowed($email,$account,$this->purchases);$order=$this->purchases->create($email,$plan,$account);$this->query('INSERT INTO transfer_orders VALUES(?,?,?,?,?)',[$hash,$fingerprint,$order['order_id'],$this->seal($billing),$now]);}
            $this->db->exec('COMMIT');return ['ok'=>true,'order_id'=>$order['order_id'],'currency'=>$order['currency'],'amount_minor'=>$order['amount_minor'],'payment_reference'=>$order['order_id'],'status'=>$order['status']];
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    public function confirm(string $orderId,string $bankReference,string $currency,int $amount,array $settings):array {
        if(!preg_match('/^[A-Za-z0-9_-]{6,120}$/D',$bankReference))throw new \RuntimeException('BANK_REFERENCE_INVALID');$order=$this->purchases->order($orderId);
        if($currency!==$order['currency']||$amount!==$order['amount_minor'])throw new \RuntimeException('BANK_SALE_MISMATCH');if($order['status']==='pending')$this->members?->assertPurchaseAllowed($order['email'],$order['account_type'],$this->purchases);
        $reference=hash_hmac('sha256',$bankReference,$this->key);$this->db->exec('BEGIN IMMEDIATE');try{
            $prior=$this->query('SELECT * FROM transfer_receipts WHERE bank_reference=? OR order_id=?',[$reference,$orderId])->fetch(\PDO::FETCH_ASSOC);
            if($prior&&($prior['bank_reference']!==$reference||$prior['order_id']!==$orderId))throw new \RuntimeException('BANK_RECEIPT_REUSED');
            if(!$prior)$this->query('INSERT INTO transfer_receipts VALUES(?,?,?,?,?)',[$reference,$orderId,$currency,$amount,time()]);$this->db->exec('COMMIT');
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
        // Reserve this bank receipt before committing payment in the other DB.
        $receipt=['status'=>'sale_confirmed','merchant_id'=>$settings['merchant_id'],'terminal_id'=>$settings['terminal_id'],'transaction_id'=>$order['transaction_id'],'order_id'=>$orderId,'currency'=>$currency,'amount_minor'=>$amount];
        $adapter=new class($receipt) implements BankVerifier {public function __construct(private array $receipt){}public function querySale(string $transactionId):array{if($transactionId!==$this->receipt['transaction_id'])throw new \RuntimeException('BANK_SALE_MISMATCH');return $this->receipt;}};
        return $this->purchases->confirm($orderId,$adapter);
    }
}
