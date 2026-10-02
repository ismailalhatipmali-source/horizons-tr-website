<?php
declare(strict_types=1);
require __DIR__.'/../src/activation/MembershipBridge.php';
function assertBridge(bool $ok):void{if(!$ok)throw new RuntimeException('ASSERTION_FAILED');}
function bridgeReject(callable $f,string $reason):void{try{$f();}catch(\Horizons\ServiceError $e){assertBridge($e->reason===$reason);return;}throw new RuntimeException('EXPECTED_REJECTION');}
$root=sys_get_temp_dir().'/hzn-issuer-'.bin2hex(random_bytes(8));mkdir($root,0700);
try{
    // Ephemeral test keys only; production vault/config are never loaded.
    $pair=sodium_crypto_sign_keypair();$key=random_bytes(32);
    file_put_contents($root.'/vault.json',json_encode(['schema'=>1,'product'=>\Horizons\PRODUCT,'signing_private_key'=>base64_encode(sodium_crypto_sign_secretkey($pair)),'content_key'=>base64_encode(random_bytes(32))]));
    $crypto=new \Horizons\Crypto(['data_key'=>base64_encode($key),'vault_path'=>$root.'/vault.json']);
    $clock=new class implements \Horizons\Clock{public int $time=1800000000;public function now():int{return $this->time;}};
    $store=new \Horizons\Store($root.'/activation.sqlite',$clock);
    $existing=$store->account($crypto->keyed('email','old@example.test'),$clock->now());
    $store->query('UPDATE accounts SET password_hash=?,password_version=7 WHERE id=?',['original-test-hash',$existing]);
    $bridge=new \Horizons\MembershipBridge($store,$crypto,$clock);
    $request=['member_id'=>'mem_first','group_id'=>'grp_family','account_type'=>'family','email'=>'OLD@example.test','starts_at'=>$clock->now(),'expires_at'=>$clock->now()+86400,'device_policy'=>'any_device'];
    assertBridge($bridge->grantMembership($request)===$existing);assertBridge($bridge->grantMembership($request)===$existing);
    assertBridge((int)$store->query('SELECT COUNT(*) FROM membership_delivery')->fetchColumn()===1);
    $account=$store->query('SELECT * FROM accounts WHERE id=?',[$existing])->fetch(PDO::FETCH_ASSOC);
    assertBridge($account['password_hash']==='original-test-hash'&&(int)$account['password_version']===7);
    $right=$bridge->active('mem_first',$existing);assertBridge($crypto->open($right['email_cipher'])==='old@example.test');
    assertBridge(!str_contains($right['email_cipher'],'old@example.test'));
    bridgeReject(fn()=>$bridge->grantMembership(array_replace($request,['email'=>'different@example.test'])),'MEMBERSHIP_CONFLICT');
    bridgeReject(fn()=>$bridge->active('mem_first','another-account'),'ENTITLEMENT_EXPIRED');
    bridgeReject(fn()=>$bridge->revokeMembership('mem_first','another-account'),'MEMBERSHIP_CONFLICT');
    $second=array_replace($request,['member_id'=>'mem_second','email'=>'second@example.test']);
    $secondId=$bridge->grantMembership($second);assertBridge($secondId!==$existing);
    $bridge->revokeMembership('mem_first',$existing);$bridge->revokeMembership('mem_first',$existing);
    bridgeReject(fn()=>$bridge->grantMembership($request),'ENTITLEMENT_EXPIRED');
    bridgeReject(fn()=>$bridge->active('mem_first',$existing),'ENTITLEMENT_EXPIRED');
    assertBridge($store->query('SELECT state FROM membership_delivery WHERE member_id=?',['mem_first'])->fetchColumn()==='cancelled');
    assertBridge($bridge->active('mem_second',$secondId)['account_id']===$secondId);
    assertBridge($store->query('SELECT password_hash FROM accounts WHERE id=?',[$existing])->fetchColumn()==='original-test-hash');
    bridgeReject(fn()=>$bridge->grantMembership(array_replace($request,['member_id'=>'mem_school','account_type'=>'institution','expires_at'=>null])),'INVALID_REQUEST');
    $clock->time+=86400;bridgeReject(fn()=>$bridge->active('mem_second',$secondId),'ENTITLEMENT_EXPIRED');
    echo "PASS: actual issuer store adapter; stable account/password preservation; encrypted email; one durable delivery job; conflicting retries rejected; scoped revocation and expiry. No SMTP or live activation asserted.\n";
}finally{unset($bridge,$store);foreach(glob($root.'/*')as $file)unlink($file);rmdir($root);}
