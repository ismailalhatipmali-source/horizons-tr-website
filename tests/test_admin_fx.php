<?php
declare(strict_types=1);
require __DIR__.'/../src/checkout/ExchangeRates.php';
require __DIR__.'/../src/admin/AdminStore.php';
require __DIR__.'/../src/admin/AdminService.php';
require __DIR__.'/../src/activation/bootstrap.php';
function check(bool $v,string $m='assert'):void{if(!$v)throw new RuntimeException($m);}
function rejects(callable $f,string $m):void{try{$f();}catch(Throwable $e){check($e->getMessage()===$m,'Expected '.$m.', got '.$e->getMessage());return;}throw new RuntimeException('Expected '.$m);}
$root=sys_get_temp_dir().'/hzn-admin-'.bin2hex(random_bytes(8));mkdir($root,0700);mkdir($root.'/public_html');mkdir($root.'/fx');$now=time();$key=random_bytes(32);
$xml='<Tarih_Date Date="'.gmdate('m/d/Y',$now).'"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexBuying>48.9</ForexBuying><ForexSelling>49.0348</ForexSelling></Currency><Currency CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>55.2967</ForexBuying><ForexSelling>55.3963</ForexSelling></Currency></Tarih_Date>';
try{
 $catalog=json_decode(file_get_contents(__DIR__.'/../src/commerce/products.json'),true);$product='horizons-arabic-level1';$offer=$catalog['products'][$product]['offers'][0];$calls=0;
 $fx=new \HorizonsCheckout\ExchangeRates($root.'/fx',$key,300,function($url)use($xml,&$calls){$calls++;return $xml;});
 $usd=$fx->quote($catalog,$product,$offer['id'],'USD',$now);check($usd['amount_minor']===999&&$usd['margin_bps']===0&&$calls===0,'USD identity');
 $try=$fx->quote($catalog,$product,$offer['id'],'TRY',$now);check($try['amount_minor']===(int)ceil(999*49.0348*1.03),'TRY upward rounding');check($try['margin_bps']===300&&$calls===1);
 $eur=$fx->quote($catalog,$product,$offer['id'],'EUR',$now);check($eur['currency']==='EUR'&&$calls===1,'Cache');
 check($fx->verify($try['token'],$product,$offer,$now)['amount_minor']===$try['amount_minor']);
 rejects(fn()=>$fx->verify($try['token'].'a',$product,$offer,$now),'FX_INVALID');rejects(fn()=>$fx->verify($try['token'],$product,$offer,$now+900),'FX_EXPIRED');
 rejects(fn()=>$fx->verify($try['token'],$product,array_replace($offer,['price_minor'=>1000]),$now),'FX_EXPIRED');
 rejects(fn()=>$fx->parseTcmb('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]>'.$xml,$now),'FX_INVALID');
 rejects(fn()=>$fx->parseTcmb(str_replace(gmdate('m/d/Y',$now),'01/01/2000',$xml),$now),'FX_STALE');
 unlink($root.'/fx/fx-cache.json');$fallback=new \HorizonsCheckout\ExchangeRates($root.'/fx',$key,300,static function($url)use($now){if(str_contains($url,'tcmb'))throw new RuntimeException();return json_encode([['base'=>'USD','quote'=>'TRY','rate'=>100,'date'=>gmdate('Y-m-d',$now)],['base'=>'USD','quote'=>'EUR','rate'=>0.88,'date'=>gmdate('Y-m-d',$now)]]);});
 $large=$fallback->quote($catalog,$product,'institution-annual','TRY',$now);check($large['amount_minor']===10300000&&$large['source']==='ECB via Frankfurter','No overflow');
 $cache=json_decode(file_get_contents($root.'/fx/fx-cache.json'),true);$cache['date']='2000-01-01';file_put_contents($root.'/fx/fx-cache.json',json_encode($cache));$offline=new \HorizonsCheckout\ExchangeRates($root.'/fx',$key,300,static fn($u)=>throw new RuntimeException());rejects(fn()=>$offline->rates($now),'FX_UNAVAILABLE');unlink($root.'/fx/fx-cache.json');
 $admin=new \HorizonsAdmin\AdminStore($root.'/admin.sqlite',$key);$code='';$id=$admin->startLogin('browser-A','127.0.0.1',$now,function($c)use(&$code){$code=$c;});rejects(fn()=>$admin->verifyLogin('browser-B',$id,$code,'127.0.0.1',$now),'LOGIN_INVALID');$admin->verifyLogin('browser-A',$id,$code,'127.0.0.1',$now);rejects(fn()=>$admin->verifyLogin('browser-A',$id,$code,'127.0.0.1',$now),'LOGIN_INVALID');
 $id=$admin->startLogin('browser-A','127.0.0.1',$now,function($c)use(&$code){$code=$c;});for($i=0;$i<5;$i++)rejects(fn()=>$admin->verifyLogin('browser-A',$id,'wrong','127.0.0.1',$now),'LOGIN_INVALID');rejects(fn()=>$admin->verifyLogin('browser-A',$id,$code,'127.0.0.1',$now),'LOGIN_INVALID');
 $id=$admin->startLogin('browser-A','127.0.0.1',$now,function($c)use(&$code){$code=$c;});rejects(fn()=>$admin->verifyLogin('browser-A',$id,$code,'127.0.0.1',$now+601),'LOGIN_INVALID');check(!str_contains(file_get_contents($root.'/admin.sqlite'),$code),'No plaintext OTP');
 $pair=sodium_crypto_sign_keypair();file_put_contents($root.'/vault.json',json_encode(['schema'=>1,'product'=>\Horizons\PRODUCT,'signing_private_key'=>base64_encode(sodium_crypto_sign_secretkey($pair)),'content_key'=>base64_encode(random_bytes(32))]));
 $config=['enabled'=>true,'memberships_enabled'=>true,'payments_enabled'=>false,'database_path'=>$root.'/activation.sqlite','vault_path'=>$root.'/vault.json','data_key'=>base64_encode(random_bytes(32)),'code_path'=>realpath(__DIR__.'/../src/activation'),'document_root'=>$root.'/public_html','smtp'=>[]];
 $store=new \Horizons\Store($config['database_path']);$crypto=new \Horizons\Crypto($config);$bridge=new \Horizons\MembershipBridge($store,$crypto);$service=new \HorizonsAdmin\AdminService($admin,$config,$root.'/public_html');$count=0;$firstReference='';
 foreach($catalog['products'][$product]['offers'] as $o){
  $currency=$count%2?'TRY':'USD';$q=$fx->quote($catalog,$product,$o['id'],$currency,$now);$email='admin-test-'.$count.'@example.test';$input=['request_id'=>bin2hex(random_bytes(16)),'product'=>$product,'offer'=>$o['id'],'quote_token'=>$q['token'],'email'=>$email,'email_confirm'=>$email,'name'=>'Synthetic buyer','phone'=>'+905550000000','country'=>'Türkiye','city'=>'İstanbul','address'=>'Synthetic billing address','billing'=>'individual','customer_confirmed'=>true,'locale'=>'ar'];
  rejects(fn()=>$admin->create(array_replace($input,['email_confirm'=>'different@example.test']),$catalog,$fx,$now),'EMAIL_MISMATCH');
  $order=$admin->create($input,$catalog,$fx,$now);check($admin->create($input,$catalog,$fx,$now+1)['id']===$order['id'],'Create idempotent');rejects(fn()=>$admin->create(array_replace($input,['name'=>'changed']),$catalog,$fx,$now),'REQUEST_REUSED');
  rejects(fn()=>$service->fulfil($order['id'],$email,true),'INVOICE_REQUIRED');rejects(fn()=>$admin->invoice($order['id'],'INV-TEST-2026',true),'PAYMENT_REQUIRED');
  $ref='BANK-TEST-000'.$count;$pay=['bank_reference'=>$ref,'verified'=>true,'currency'=>$currency,'amount_minor'=>$q['amount_minor']];rejects(fn()=>$admin->payment($order['id'],array_replace($pay,['amount_minor'=>1])),'AMOUNT_MISMATCH');
  if($count)rejects(fn()=>$admin->payment($order['id'],array_replace($pay,['bank_reference'=>$firstReference])),'RECEIPT_REUSED');else $firstReference=$ref;
  $admin->payment($order['id'],$pay);$admin->invoice($order['id'],'INV-TEST-2026-'.$count,true);rejects(fn()=>$service->fulfil($order['id'],'wrong@example.test',true),'EMAIL_MISMATCH');
  $done=$service->fulfil($order['id'],$email,true);check($done['status']==='fulfilled','Fulfilled');check($service->fulfil($order['id'],$email,true)['data']['group_id']===$done['data']['group_id'],'Fulfil idempotent');
  $rights=$store->query('SELECT account_type,plan FROM membership_rights WHERE account_id=?',[$done['data']['account_id']])->fetch(PDO::FETCH_ASSOC);check($rights['account_type']===$o['account_type']&&$rights['plan']===$o['term'],'Correct plan');
  $members=new \HorizonsCommerce\MembershipLedger($root.'/memberships.sqlite',$root.'/public_html',hash_hmac('sha256','membership-ledger-v1',$crypto->dataKey,true));$policy=$members->policy($done['data']['group_id'],$done['data']['account_id'],time());check($policy['max_learners']===(['individual'=>1,'family'=>5,'institution'=>100][$o['account_type']]),'Correct entitlement');$count++;
 }
 check($count===7);check((int)$store->query('SELECT COUNT(*) FROM membership_rights')->fetchColumn()===7,'No duplicate rights');check((int)$store->query("SELECT COUNT(*) FROM membership_delivery WHERE state='pending'")->fetchColumn()===7,'Queued, never sent');check(count($service->customers()['customers'])===7,'Read-only customer listing');
 check(!str_contains(file_get_contents($root.'/admin.sqlite'),'Synthetic billing address'),'Encrypted PII');check(count($admin->listing()['orders'])===7,'Order listing');
 echo "PASS: FX cache/fallback/rounding/staleness/tamper/expiry; owner OTP binding, one-use, lockout; seven paid/invoiced plans, seat limits 1/5/100, idempotence, encrypted PII, queued delivery. No network or SMTP.\n";
}finally{unset($members,$bridge,$crypto,$store,$service,$admin);$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){if($f->isDir())rmdir($f->getPathname());else unlink($f->getPathname());}rmdir($root);}
