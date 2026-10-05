<?php
declare(strict_types=1);
require __DIR__.'/../src/activation/Core.php';
// Ephemeral store, generated test keys and captured mail only. No host config or SMTP.
$root=sys_get_temp_dir().'/hzn-trial-pause-'.bin2hex(random_bytes(8));
mkdir($root,0700);
try {
    $pair=sodium_crypto_sign_keypair();
    file_put_contents($root.'/vault.json',json_encode(['schema'=>1,'product'=>\Horizons\PRODUCT,
        'signing_private_key'=>base64_encode(sodium_crypto_sign_secretkey($pair)),
        'content_key'=>base64_encode(random_bytes(32))]));
    $crypto=new \Horizons\Crypto(['data_key'=>base64_encode(random_bytes(32)),'vault_path'=>$root.'/vault.json']);
    $clock=new class implements \Horizons\Clock {public function now():int{return 1800000000;}};
    $store=new \Horizons\Store($root.'/activation.sqlite',$clock);
    $mail=new class implements \Horizons\Mailer {
        public string $last='';
        public function code(string $email,string $code,string $locale):void{$this->last=$code;}
    };
    $purchases=new class implements \Horizons\Purchases {
        public function find(string $email):?array{return null;}
        public function byId(string $saleId):?array{return null;}
    };
    $rsa=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
    $pub=preg_replace('/-----[^-]+-----|\s/','',openssl_pkey_get_details($rsa)['key']);
    foreach (['default','explicit-false'] as $mode) {
        $service=$mode==='default'
            ? new \Horizons\Service($store,$crypto,$purchases,$mail,$clock)
            : new \Horizons\Service($store,$crypto,$purchases,$mail,$clock,false);
        $identity=['device_id'=>str_repeat('a',64),'public_key'=>$pub,'email'=>$mode.'@example.test',
            'plan'=>'trial_7d','auto_trial_enabled'=>true]; // Browser fields cannot enable a grant.
        $challenge=$service->request($identity,'fixture-'.$mode);
        try {
            $service->verify($identity+['challenge_id'=>$challenge['challenge_id'],'code'=>$mail->last],'fixture-'.$mode);
            throw new RuntimeException('UNEXPECTED_TRIAL_GRANT');
        } catch (\Horizons\ServiceError $e) {
            if ($e->reason!=='PURCHASE_UNAVAILABLE') throw $e;
        }
        if ((int)$store->query('SELECT COUNT(*) FROM entitlements')->fetchColumn()!==0)
            throw new RuntimeException('UNEXPECTED_ENTITLEMENT');
    }
    echo "PASS: default and explicit-false activation reject an automatic full-workbook trial after valid OTP, including forged browser trial fields. Host configuration not tested.\n";
} finally {
    unset($service,$store);
    foreach (glob($root.'/*') as $path) unlink($path);
    rmdir($root);
}
