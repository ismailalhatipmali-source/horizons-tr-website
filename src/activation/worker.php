<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
try{
    $path=$argv[1]??'';if(!is_file($path)||is_link($path))throw new RuntimeException('CONFIG_REQUIRED');$config=require $path;
    $root=realpath($config['document_root']??dirname(dirname($config['code_path'])).'/public_html');$real=realpath($path);if(!$root||!$real||str_starts_with($real,$root.DIRECTORY_SEPARATOR))throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
    require_once __DIR__.'/commerce-bootstrap.php';$config=\Horizons\membershipFeatures($config);
    $lock=fopen(dirname($config['database_path']).'/membership-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit(0);
    if(($argv[2]??'')==='confirm-transfer'){
        [$checkout,$fulfilment,$service,$members,$bridge,$settings]=\Horizons\commerceApplication($config);$amount=$argv[6]??'';
        if(!ctype_digit($amount)||strlen($amount)>9)throw new RuntimeException('AMOUNT_MINOR_REQUIRED');
        $checkout->confirm($argv[3]??'',$argv[4]??'',$argv[5]??'',(int)$amount,$settings);$fulfilment->fulfil($argv[3]);
    }elseif(($config['transfer_sales_enabled']??false)===true){
        [,$fulfilment,$service,$members,$bridge,,$purchases]=\Horizons\commerceApplication($config);foreach($purchases->unfulfilled() as $order)$fulfilment->fulfil($order);
    }else{[$service,$members,$bridge]=\Horizons\membershipApplication($config);}
    for($i=0;$i<20&&$members->work($bridge,time());$i++){}
    for($i=0;$i<20&&$service->deliver();$i++){}
    echo "OK: membership queue processed.\n";
}catch(Throwable $e){fwrite(STDERR,"FAILED: no private error details printed. Review installation and retry the same operation.\n");exit(1);}
