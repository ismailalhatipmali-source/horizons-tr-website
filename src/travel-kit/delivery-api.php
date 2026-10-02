<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');
try{
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')throw new RuntimeException('FORBIDDEN');
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='https://horizons-tr.com'))throw new RuntimeException('FORBIDDEN');
    session_name('__Secure-hzn_admin');session_set_cookie_params(['lifetime'=>0,'path'=>'/admin/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start(['use_strict_mode'=>1,'use_only_cookies'=>1]);
    $now=time();if(!isset($_SESSION['signed_at'],$_SESSION['last_seen'])||$now-$_SESSION['signed_at']>=900||$now-$_SESSION['last_seen']>=1800)throw new RuntimeException('LOGIN_REQUIRED');
    $_SESSION['last_seen']=$now;$csrf=$_SESSION['csrf']??'';session_write_close();
    if(!is_string($csrf)||!preg_match('/^[a-f0-9]{64}$/D',$csrf))throw new RuntimeException('LOGIN_REQUIRED');
    $web=realpath($_SERVER['DOCUMENT_ROOT']);$home=realpath(dirname($web));$private=$home.'/horizons-travel-delivery';$review=$home.'/horizons-checkout-review';
    if(!$home||!$web||is_link($private)||is_link($review)||str_starts_with($private,$web.'/'))throw new RuntimeException('DELIVERY_UNAVAILABLE');
    require $private.'/TravelDelivery.php';$key=file_get_contents($review.'/key.bin');$delivery=new \HorizonsTravel\TravelDelivery($private,$key);
    if(($_SERVER['REQUEST_METHOD']??'')==='GET'){$delivery->product();echo json_encode(['ok'=>true,'csrf'=>$csrf,'available'=>true]);exit;}
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals($csrf,$_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new RuntimeException('FORBIDDEN');
    if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')||(int)($_SERVER['CONTENT_LENGTH']??0)>2048)throw new RuntimeException('INVALID_REQUEST');
    $raw=file_get_contents('php://input',false,null,0,2049);$input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input)||array_diff(array_keys($input),['reference','email','receipt','payment_confirmed'])||!is_string($input['reference']??null)||!is_string($input['email']??null)||!is_string($input['receipt']??null))throw new RuntimeException('INVALID_REQUEST');
    if(!preg_match('/^HZN-M-[0-9]{8}-[A-F0-9]{16}$/D',$input['reference']))throw new RuntimeException('ORDER_NOT_FOUND');
    $dbPath=$review.'/manual-orders.sqlite';if(is_link($dbPath)||!is_file($dbPath))throw new RuntimeException('ORDER_NOT_FOUND');
    $db=new PDO('sqlite:'.$dbPath,null,null,[PDO::SQLITE_ATTR_OPEN_FLAGS=>PDO::SQLITE_OPEN_READONLY]);$q=$db->prepare('SELECT payload FROM manual_orders WHERE reference=?');$q->execute([$input['reference']]);$cipher=base64_decode($q->fetchColumn()?:'',true);
    if(!$cipher||strlen($cipher)<40)throw new RuntimeException('ORDER_NOT_FOUND');$plain=sodium_crypto_secretbox_open(substr($cipher,24),substr($cipher,0,24),$key);if($plain===false)throw new RuntimeException('DELIVERY_UNAVAILABLE');
    $order=json_decode($plain,true,16,JSON_THROW_ON_ERROR);$order['reference']=$input['reference'];
    $result=$delivery->issue($order,$input['email'],$input['receipt'],($input['payment_confirmed']??false)===true,$now);
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
}catch(Throwable $e){$allowed=['LOGIN_REQUIRED','FORBIDDEN','PRODUCT_NOT_INSTALLED','PAYMENT_CONFIRM_REQUIRED','ORDER_NOT_FOUND','EMAIL_MISMATCH','INVALID_RECEIPT','RECEIPT_REUSED','INVALID_REQUEST'];$reason=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'DELIVERY_UNAVAILABLE';http_response_code($reason==='LOGIN_REQUIRED'?401:($reason==='FORBIDDEN'?403:400));echo json_encode(['ok'=>false,'error'=>$reason]);}
