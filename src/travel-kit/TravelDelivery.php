<?php
declare(strict_types=1);
namespace HorizonsTravel;

final class TravelDelivery {
    private \PDO $db;
    public function __construct(private readonly string $private,private readonly string $key){
        if(strlen($key)!==32||is_link($private)||!is_dir($private))throw new \RuntimeException('DELIVERY_UNAVAILABLE');
        $file=$private.'/delivery.sqlite';if(is_link($file))throw new \RuntimeException('DELIVERY_UNAVAILABLE');
        $this->db=new \PDO('sqlite:'.$file,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);chmod($file,0600);
        $this->db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS deliveries(token_hash TEXT PRIMARY KEY,order_reference TEXT NOT NULL,email_hash TEXT NOT NULL,receipt_hash TEXT NOT NULL,expires INTEGER NOT NULL,uses INTEGER NOT NULL DEFAULT 0,revoked INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS receipts(receipt_hash TEXT PRIMARY KEY,order_reference TEXT NOT NULL)');
    }
    public function product():array{
        $manifest=$this->private.'/product.json';if(is_link($manifest)||!is_file($manifest))throw new \RuntimeException('PRODUCT_NOT_INSTALLED');
        $p=json_decode(file_get_contents($manifest),true,8,JSON_THROW_ON_ERROR);
        if(($p['verified']??false)!==true||count($p['languages']??[])!==32||!preg_match('/^HORIZONS_Travel_Agent_Client_Kit_32_Languages_v[0-9.]+\.zip$/D',$p['filename']??''))throw new \RuntimeException('PRODUCT_NOT_INSTALLED');
        $file=$this->private.'/'.$p['filename'];if(is_link($file)||!is_file($file)||filesize($file)!==$p['size_bytes'])throw new \RuntimeException('PRODUCT_NOT_INSTALLED');
        return $p+['path'=>$file];
    }
    public function issue(array $order,string $email,string $receipt,bool $confirmed,int $now):array{
        if(!$confirmed)throw new \RuntimeException('PAYMENT_CONFIRM_REQUIRED');
        $email=strtolower(trim($email));
        if(($order['product']??'')!=='travel-agent-client-kit'||!preg_match('/^HZN-M-[0-9]{8}-[A-F0-9]{16}$/D',$order['reference']??''))throw new \RuntimeException('ORDER_NOT_FOUND');
        if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$email!==($order['buyer']['email']??''))throw new \RuntimeException('EMAIL_MISMATCH');
        $receipt=trim($receipt);if(strlen($receipt)<3||strlen($receipt)>100||preg_match('/[\x00-\x1f\x7f]/',$receipt))throw new \RuntimeException('INVALID_RECEIPT');
        $this->product();$token=bin2hex(random_bytes(32));$tokenHash=hash('sha256',$token);$receiptHash=hash_hmac('sha256','receipt:'.$receipt,$this->key);$emailHash=hash_hmac('sha256','email:'.$email,$this->key);$expires=$now+7*86400;
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $q=$this->db->prepare('SELECT order_reference FROM receipts WHERE receipt_hash=?');$q->execute([$receiptHash]);$old=$q->fetchColumn();if($old!==false&&$old!==$order['reference'])throw new \RuntimeException('RECEIPT_REUSED');
            $q=$this->db->prepare('INSERT OR IGNORE INTO receipts VALUES(?,?)');$q->execute([$receiptHash,$order['reference']]);
            $q=$this->db->prepare('UPDATE deliveries SET revoked=1 WHERE order_reference=?');$q->execute([$order['reference']]);
            $q=$this->db->prepare('INSERT INTO deliveries(token_hash,order_reference,email_hash,receipt_hash,expires) VALUES(?,?,?,?,?)');$q->execute([$tokenHash,$order['reference'],$emailHash,$receiptHash,$expires]);
            $this->db->exec('COMMIT');
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
        // Fragment keeps the bearer secret out of web-server URL/referrer logs.
        // The owner copies and emails this link; no automatic delivery mail.
        return ['reference'=>$order['reference'],'url'=>'https://horizons-tr.com/travel-download/#'.$token,'expires_at'=>$expires,'max_downloads'=>5];
    }
    public function claim(string $token,int $now):array{
        if(!preg_match('/^[a-f0-9]{64}$/D',$token))throw new \RuntimeException('LINK_INVALID');
        $p=$this->product();$this->db->exec('BEGIN IMMEDIATE');
        try{
            $q=$this->db->prepare('SELECT expires,uses,revoked FROM deliveries WHERE token_hash=?');$q->execute([hash('sha256',$token)]);$row=$q->fetch(\PDO::FETCH_ASSOC);
            if(!$row||$row['revoked']||$row['expires']<=$now||$row['uses']>=5)throw new \RuntimeException('LINK_INVALID');
            $q=$this->db->prepare('UPDATE deliveries SET uses=uses+1 WHERE token_hash=?');$q->execute([hash('sha256',$token)]);$this->db->exec('COMMIT');return $p;
        }catch(\Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
}
