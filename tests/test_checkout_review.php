<?php
declare(strict_types=1);
require __DIR__.'/../src/checkout/ReviewOrders.php';
function checkReview(bool $value):void{if(!$value)throw new RuntimeException('ASSERTION_FAILED');}
function rejectReview(callable $f,string $expected):void{try{$f();}catch(Throwable $e){checkReview($e->getMessage()===$expected);return;}throw new RuntimeException('EXPECTED_REJECTION');}
$dir=sys_get_temp_dir().'/hzn-review-test-'.bin2hex(random_bytes(8));mkdir($dir,0700);
try{
 $key=random_bytes(32);$catalog=json_decode(file_get_contents(__DIR__.'/../src/commerce/products.json'),true);
 $catalog['products']['future-test']=['id'=>'future-test','name'=>'Different product','available'=>true,'offers'=>[['id'=>'standard','price_minor'=>1234,'currency'=>'EUR','tax_included'=>true]]];
 $service=new \HorizonsCheckout\ReviewOrders($dir.'/review.sqlite',$key,$catalog);
 $input=['request_id'=>bin2hex(random_bytes(16)),'product'=>'horizons-arabic-level1','offer'=>'individual-monthly','method'=>'transfer','buyer'=>['first_name'=>'Test','last_name'=>'Buyer','email'=>'buyer@example.test','email_confirm'=>'buyer@example.test','phone'=>'+905550000000','country_code'=>'TR','country'=>'Türkiye','city'=>'İstanbul','address'=>'Test billing address','postal'=>'','billing'=>'individual'],'terms_accepted'=>true,'privacy_read'=>true,'permanent_acknowledged'=>true,'policy_version'=>$catalog['policy_version'],'locale'=>'tr'];
 $r=$service->create($input,'client','test-ip',time());checkReview($r['amount_minor']===999&&$r['currency']==='USD'&&$r['payment_status']==='unpaid'&&$r['invoice_status']==='not_issued'&&$r['fulfilment_status']==='not_started');
 checkReview($service->create($input,'client','test-ip',time())['reference']===$r['reference']);
 rejectReview(fn()=>$service->create(array_replace($input,['offer'=>'family-annual']),'client','test-ip',time()),'REQUEST_REUSED');
 foreach(['terms_accepted','privacy_read','permanent_acknowledged'] as $flag)rejectReview(fn()=>$service->create(array_replace($input,[$flag=>false]),'client','test-ip',time()),'CONSENT_REQUIRED');
 rejectReview(fn()=>$service->create(array_replace($input,['method'=>'card']),'client','test-ip',time()),'CARD_NOT_ENABLED');
 rejectReview(fn()=>$service->create(array_replace($input,['price_minor'=>1]),'client','test-ip',time()),'INVALID_REQUEST');
 rejectReview(fn()=>$service->create(array_replace($input,['card_number'=>'1234']),'client','test-ip',time()),'INVALID_REQUEST');
 $bad=$input;$bad['buyer']['country_code']='DE';rejectReview(fn()=>$service->create($bad,'client','test-ip',time()),'TRANSFER_TURKEY_ONLY');
 $bad=$input;$bad['buyer']['billing']='company';rejectReview(fn()=>$service->create($bad,'client','test-ip',time()),'INVALID_BUYER');
 $bad=$input;$bad['buyer']['email_confirm']='other@example.test';rejectReview(fn()=>$service->create($bad,'client','test-ip',time()),'EMAIL_MISMATCH');
 $new=$input;$new['request_id']=bin2hex(random_bytes(16));$new['product']='future-test';$new['offer']='standard';$second=$service->create($new,'client','test-ip',time());checkReview($second['reference']!==$r['reference']&&$second['amount_minor']===1234&&$second['currency']==='EUR');
 $db=new PDO('sqlite:'.$dir.'/review.sqlite');checkReview((int)$db->query('SELECT COUNT(*) FROM review_orders')->fetchColumn()===2);
 $cipher=$db->query('SELECT payload FROM review_orders LIMIT 1')->fetchColumn();$raw=base64_decode($cipher);$decoded=json_decode(sodium_crypto_secretbox_open(substr($raw,24),substr($raw,0,24),$key),true);checkReview($decoded['buyer']['email']==='buyer@example.test');
 checkReview(!str_contains(file_get_contents($dir.'/review.sqlite'),'buyer@example.test'));
 echo "PASS: unique server references, repeat-safe requests, authoritative prices, required consents, no card data, private encryption, another product, unpaid-only state. No bank or email invoked.\n";
}finally{unset($db,$service);foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir);}
