<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
header('Cache-Control: no-store, private');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex, nofollow');
try{
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off'||($_SERVER['REQUEST_METHOD']??'')!=='POST'||(int)($_SERVER['CONTENT_LENGTH']??0)>512)throw new RuntimeException('LINK_INVALID');
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='https://horizons-tr.com'))throw new RuntimeException('LINK_INVALID');
    $web=realpath($_SERVER['DOCUMENT_ROOT']);$home=realpath(dirname($web));$private=$home.'/horizons-travel-delivery';$review=$home.'/horizons-checkout-review';
    if(!$web||!$home||is_link($private)||is_link($review))throw new RuntimeException('LINK_INVALID');require $private.'/TravelDelivery.php';
    $delivery=new \HorizonsTravel\TravelDelivery($private,file_get_contents($review.'/key.bin'));$token=$_POST['token']??'';if(!is_string($token))throw new RuntimeException('LINK_INVALID');$p=$delivery->claim($token,time());
    $f=fopen($p['path'],'rb');if(!$f)throw new RuntimeException('LINK_INVALID');
    header('Content-Type: application/zip');header('Content-Disposition: attachment; filename="'.$p['filename'].'"');header('Content-Length: '.filesize($p['path']));
    set_time_limit(0);while(!feof($f)){echo fread($f,1048576);if(connection_aborted())break;}fclose($f);
}catch(Throwable){http_response_code(403);header('Content-Type: text/plain; charset=utf-8');echo 'Download link is invalid, expired or exhausted. Contact support@horizons-tr.com';}
