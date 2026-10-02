<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
try{
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')throw new RuntimeException('SERVICE_UNAVAILABLE');
    $web=realpath($_SERVER['DOCUMENT_ROOT']);$home=realpath(dirname($web));if(!$web||!$home)throw new RuntimeException('SERVICE_UNAVAILABLE');
    $private=$home.'/horizons-checkout-review';if(is_link($private)||!is_dir($private))throw new RuntimeException('SERVICE_UNAVAILABLE');
    $method=$_SERVER['REQUEST_METHOD']??'';if(!in_array($method,['GET','POST'],true)){http_response_code(405);echo '{"ok":false,"error":"METHOD_NOT_ALLOWED"}';exit;}
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='https://horizons-tr.com')){http_response_code(403);echo '{"ok":false,"error":"FORBIDDEN"}';exit;}
    session_name('hzn_manual_order');session_set_cookie_params(['lifetime'=>0,'path'=>'/manual-order-api/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start(['use_strict_mode'=>1,'use_only_cookies'=>1]);
    $_SESSION['csrf']??=bin2hex(random_bytes(32));$csrf=$_SESSION['csrf'];$client=session_id();session_write_close();
    if($method==='GET'){echo json_encode(['ok'=>true,'csrf'=>$csrf,'mode'=>'manual_email','collection_enabled'=>false],JSON_THROW_ON_ERROR);exit;}
    if(!hash_equals($csrf,$_SERVER['HTTP_X_CSRF_TOKEN']??'')){http_response_code(403);echo '{"ok":false,"error":"FORBIDDEN"}';exit;}
    if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')||(int)($_SERVER['CONTENT_LENGTH']??0)>16384)throw new RuntimeException('INVALID_REQUEST');
    $body=file_get_contents('php://input',false,null,0,16385);if($body===false||strlen($body)>16384)throw new RuntimeException('INVALID_REQUEST');
    $input=json_decode($body,true,8,JSON_THROW_ON_ERROR);if(!is_array($input)||array_is_list($input))throw new RuntimeException('INVALID_REQUEST');
    $catalog=json_decode(file_get_contents($private.'/products.json'),true,16,JSON_THROW_ON_ERROR);
    require_once $private.'/ManualOrders.php';require_once $private.'/ManualOrderMailer.php';
    $orders=new \HorizonsCheckout\ManualOrders($private.'/manual-orders.sqlite',file_get_contents($private.'/key.bin'),$catalog);
    $order=$orders->create($input,$client,$_SERVER['REMOTE_ADDR']??'unknown',time());
    $pointer=$web.'/activation/config-path.php';if(!is_file($pointer)||is_link($pointer))throw new RuntimeException('SERVICE_UNAVAILABLE');
    $configPath=require $pointer;$real=is_string($configPath)?realpath($configPath):false;
    if(!$real||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/'))throw new RuntimeException('SERVICE_UNAVAILABLE');
    ob_start();try{$config=require $real;}finally{ob_end_clean();}
    $mailer=new \HorizonsCheckout\ManualOrderMailer($config['smtp']??[]);
    $buyer=$order['buyer'];$product=$order['product'];$offer=$order['offer'];$amount=number_format(((int)$offer['price_minor'])/100,2,'.','').' '.$offer['currency'];
    if(!$order['owner_notified']){
        $owner=$catalog['seller']['email']??'info@horizons-tr.com';
        $ownerBody="HORIZONS — Manual order request\n\nReference: ".$order['reference']."\nProduct: ".$product['name']."\nOffer: ".($offer['label']??$offer['id'])."\nTotal: ".$amount."\n\nCustomer: ".$buyer['first_name'].' '.$buyer['last_name']."\nEmail: ".$buyer['email']."\nPhone: ".$buyer['phone']."\nCountry: ".$buyer['country']."\nCity: ".$buyer['city']."\nInvoice: ".$buyer['billing']."\n";
        if(($buyer['billing']??'')==='company')$ownerBody.="Company: ".($buyer['company_name']??'')."\nTax ID: ".($buyer['tax_id']??'')."\nTax office: ".($buyer['tax_office']??'')."\n";
        $ownerBody.="\nNo payment was collected on the website. Verify payment manually before sending any activation code or download link. Reply directly to the customer from this email thread.\n";
        $mailer->send($owner,'HORIZONS — New manual order '.$order['reference'],$ownerBody,$buyer['email']);$orders->mark($order['reference'],'owner_notified');
    }
    if(!$order['buyer_notified']){
        $locale=$order['locale'];$localeFile=$web.'/manual-order-locales.json';
        $allLocales=[];
        if(is_file($localeFile)&&!is_link($localeFile)){
            try{$allLocales=json_decode(file_get_contents($localeFile),true,32,JSON_THROW_ON_ERROR);}catch(\Throwable){$allLocales=[];}
        }
        $t=is_array($allLocales[$locale]??null)?$allLocales[$locale]:(is_array($allLocales['en']??null)?$allLocales['en']:[]);
        $subjectLine=$t['saved']??'Your order request was received.';
        $intro=$t['order_note']??'Your order details were received. No payment was charged on the website. HORIZONS will contact you by email to confirm payment and send the download link manually after verification.';
        $referenceLabel=$t['reference']??'Order reference';$totalLabel=$t['total']??'Total';$productLabel=$t['product']??'Product';$localizedProduct=$t['product_title']??$product['name'];
        $body=$subjectLine."\n\n".$intro."\n\n".$referenceLabel.": ".$order['reference']."\n".$productLabel.": ".$localizedProduct."\n".$totalLabel.": ".$amount."\n\nsupport@horizons-tr.com\n";
        $mailer->send($buyer['email'],'HORIZONS — '.$localizedProduct.' · '.$order['reference'],$body);$orders->mark($order['reference'],'buyer_notified');
    }
    echo json_encode(['ok'=>true,'reference'=>$order['reference'],'status'=>'manual_pending','payment_status'=>'not_collected','collection_enabled'=>false],JSON_THROW_ON_ERROR);
}catch(Throwable $e){
    $allowed=['INVALID_REQUEST','INVALID_BUYER','PRODUCT_UNAVAILABLE','OFFER_UNAVAILABLE','CONSENT_REQUIRED','EMAIL_MISMATCH','REQUEST_REUSED','RATE_LIMITED'];
    $reason=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'SERVICE_UNAVAILABLE';http_response_code($reason==='RATE_LIMITED'?429:($reason==='SERVICE_UNAVAILABLE'?503:400));echo json_encode(['ok'=>false,'error'=>$reason]);
}
