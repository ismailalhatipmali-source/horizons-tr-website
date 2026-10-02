<?php
// One idempotent internal test, using the same notifier and SMTP as real orders.
// Both roles use the owner's mailbox. Fixtures never enter the production order DB.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
$status=['test_only'=>true,'collection_enabled'=>false,'owner_notification_smtp_accepted'=>false,'customer_confirmation_smtp_accepted'=>false];
$web=realpath($argv[1]??'');
if(!$web||!is_dir($web)||is_link($argv[1]??''))exit(1);
$home=dirname($web);$private=$home.'/horizons-checkout-review';
try{
    if(is_link($private)||!is_dir($private))throw new RuntimeException('TEST_UNAVAILABLE');
    $fixture=$private.'/travel-kit-mail-test';
    if(is_link($fixture)||(file_exists($fixture)&&!is_dir($fixture)))throw new RuntimeException('TEST_UNAVAILABLE');
    if(!is_dir($fixture)&&!mkdir($fixture,0700))throw new RuntimeException('TEST_UNAVAILABLE');
    $catalog=json_decode(file_get_contents($private.'/products.json'),true,16,JSON_THROW_ON_ERROR);
    if(($catalog['seller']['email']??'')!=='info@horizons-tr.com')throw new RuntimeException('TEST_RECIPIENT_INVALID');
    require_once $private.'/ManualOrders.php';require_once $private.'/ManualOrderMailer.php';require_once $private.'/ManualOrderNotifier.php';
    $pointer=$web.'/activation/config-path.php';if(is_link($pointer)||!is_file($pointer))throw new RuntimeException('TEST_UNAVAILABLE');
    $configPath=require $pointer;$real=is_string($configPath)?realpath($configPath):false;
    if(!$real||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/'))throw new RuntimeException('TEST_UNAVAILABLE');
    ob_start();try{$config=require $real;}finally{ob_end_clean();}
    $locales=json_decode(file_get_contents($web.'/manual-order-locales.json'),true,32,JSON_THROW_ON_ERROR);
    $orders=new \HorizonsCheckout\ManualOrders($fixture.'/orders.sqlite',file_get_contents($private.'/key.bin'),$catalog);
    // Synthetic fixture consent flags do not represent any real person's agreement.
    $input=['request_id'=>substr(hash('sha256','HORIZONS internal travel mail test v2.0.1'),0,32),'product'=>'travel-agent-client-kit','offer'=>'single-business','locale'=>'ar','terms_accepted'=>true,'privacy_read'=>true,'buyer'=>['first_name'=>'TEST','last_name'=>'INTERNAL NO SALE','email'=>'info@horizons-tr.com','email_confirm'=>'info@horizons-tr.com','phone'=>'+900000000000','country'=>'Internal test','city'=>'Internal test','billing'=>'individual']];
    $order=$orders->create($input,'internal-mail-test','internal-test',time());
    $notifier=new \HorizonsCheckout\ManualOrderNotifier(new \HorizonsCheckout\ManualOrderMailer($config['smtp']??[]),$catalog,$locales);
    $notifier->notify($order,$orders,true);
    $order=$orders->create($input,'internal-mail-test','internal-test',time());
    $status['owner_notification_smtp_accepted']=$order['owner_notified'];
    $status['customer_confirmation_smtp_accepted']=$order['buyer_notified'];
    $db=new PDO('sqlite:'.$fixture.'/orders.sqlite');$q=$db->prepare('SELECT payload FROM manual_orders WHERE reference=?');$q->execute([$order['reference']]);$cipher=base64_decode($q->fetchColumn(),true);
    $plain=sodium_crypto_secretbox_open(substr($cipher,24),substr($cipher,0,24),file_get_contents($private.'/key.bin'));
    $record=json_decode($plain,true,16,JSON_THROW_ON_ERROR);
    if($record['payment_status']!=='not_collected'||$record['fulfilment_status']!=='manual')throw new RuntimeException('TEST_UNAVAILABLE');
    $status['payment_status']=$record['payment_status'];$status['fulfilment_status']=$record['fulfilment_status'];
    echo "PASS: both internal notification roles accepted by configured SMTP. No sale, charge or download link created.\n";
}catch(Throwable){$status['error']='MAIL_TEST_UNAVAILABLE';echo "NOTICE: internal mail test did not finish; review SMTP configuration. No charge or download link created.\n";}
$status['checked_at']=gmdate('c');
$output=$web.'/travel-kit-checks.json';
if(is_link($output))exit(1);
$temp=$output.'.tmp-'.bin2hex(random_bytes(4));
if(file_put_contents($temp,json_encode($status,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n",LOCK_EX)===false||!chmod($temp,0644)||!rename($temp,$output))exit(1);
