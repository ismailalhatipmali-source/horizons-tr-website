<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
try {
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')throw new RuntimeException('HTTPS_REQUIRED');
    $web=realpath($_SERVER['DOCUMENT_ROOT']);$home=realpath(dirname($web));$private=$home.'/horizons-checkout-review';
    if(is_link($private)||!is_dir($private)||str_starts_with(realpath($private),$web.'/'))throw new RuntimeException('REVIEW_UNAVAILABLE');
    $method=$_SERVER['REQUEST_METHOD']??'';if(!in_array($method,['GET','POST'],true)){http_response_code(405);header('Allow: GET, POST');echo '{"ok":false,"error":"METHOD_NOT_ALLOWED"}';exit;}
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='https://horizons-tr.com')){http_response_code(403);echo '{"ok":false,"error":"FORBIDDEN"}';exit;}
    session_name('hzn_checkout_review');session_set_cookie_params(['lifetime'=>0,'path'=>'/checkout-api/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start(['use_strict_mode'=>1,'use_only_cookies'=>1]);
    $_SESSION['csrf']??=bin2hex(random_bytes(32));$csrf=$_SESSION['csrf'];$client=session_id();session_write_close();
    if($method==='GET'){echo json_encode(['ok'=>true,'csrf'=>$csrf,'mode'=>'bank_review','collection_enabled'=>false]);exit;}
    if(!hash_equals($csrf,$_SERVER['HTTP_X_CSRF_TOKEN']??'')){http_response_code(403);echo '{"ok":false,"error":"FORBIDDEN"}';exit;}
    if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')||(int)($_SERVER['CONTENT_LENGTH']??0)>16384)throw new RuntimeException('INVALID_REQUEST');
    $body=file_get_contents('php://input',false,null,0,16385);if($body===false||strlen($body)>16384)throw new RuntimeException('INVALID_REQUEST');
    $input=json_decode($body,true,8,JSON_THROW_ON_ERROR);if(!is_array($input)||array_is_list($input))throw new RuntimeException('INVALID_REQUEST');
    require $private.'/ReviewOrders.php';
    $catalog=json_decode(file_get_contents($private.'/products.json'),true,16,JSON_THROW_ON_ERROR);
    $orders=new \HorizonsCheckout\ReviewOrders($private.'/review-orders.sqlite',file_get_contents($private.'/key.bin'),$catalog);
    echo json_encode($orders->create($input,$client,$_SERVER['REMOTE_ADDR']??'unknown',time()),JSON_THROW_ON_ERROR);
}catch(Throwable $e){
    $allowed=['INVALID_REQUEST','INVALID_BUYER','PRODUCT_UNAVAILABLE','OFFER_UNAVAILABLE','CARD_NOT_ENABLED','CONSENT_REQUIRED','EMAIL_MISMATCH','TRANSFER_TURKEY_ONLY','REQUEST_REUSED','RATE_LIMITED'];
    $reason=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'REVIEW_UNAVAILABLE';http_response_code($reason==='RATE_LIMITED'?429:($reason==='REVIEW_UNAVAILABLE'?503:400));echo json_encode(['ok'=>false,'error'=>$reason]);
}
