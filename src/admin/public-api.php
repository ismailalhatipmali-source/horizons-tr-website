<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
try {
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')throw new RuntimeException('HTTPS_REQUIRED');
    $method=$_SERVER['REQUEST_METHOD']??'';if(!in_array($method,['GET','POST'],true))throw new RuntimeException('INVALID_REQUEST');
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='https://horizons-tr.com'))throw new RuntimeException('FORBIDDEN');
    $web=realpath($_SERVER['DOCUMENT_ROOT']);$home=dirname($web);$dir=$home.'/horizons-admin';$review=$home.'/horizons-checkout-review';
    foreach([$dir,$review] as $p)if(is_link($p)||!is_dir($p)||str_starts_with(realpath($p),$web.'/'))throw new RuntimeException('ADMIN_UNAVAILABLE');
    require_once $dir.'/AdminStore.php';require_once $dir.'/AdminService.php';require_once $review.'/ExchangeRates.php';
    $key=file_get_contents($dir.'/key.bin');$store=new \HorizonsAdmin\AdminStore($dir.'/admin.sqlite',$key);
    session_name('__Secure-hzn_admin');session_set_cookie_params(['lifetime'=>0,'path'=>'/admin/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start(['use_strict_mode'=>1,'use_only_cookies'=>1]);
    $_SESSION['csrf']??=bin2hex(random_bytes(32));$now=time();
    $auth=isset($_SESSION['signed_at'],$_SESSION['last_seen'])&&$now-$_SESSION['signed_at']<3600&&$now-$_SESSION['last_seen']<1800;
    if($auth)$_SESSION['last_seen']=$now;else unset($_SESSION['signed_at'],$_SESSION['last_seen']);
    $catalog=json_decode(file_get_contents($review.'/products.json'),true,16,JSON_THROW_ON_ERROR);
    $settings=is_file($review.'/fx-settings.json')?json_decode(file_get_contents($review.'/fx-settings.json'),true,8,JSON_THROW_ON_ERROR):['margin_bps'=>300];
    $fx=new \HorizonsCheckout\ExchangeRates($review,file_get_contents($review.'/key.bin'),$settings['margin_bps']);
    $loadConfig=static function()use($web){$pointer=$web.'/activation/config-path.php';if(!is_file($pointer)||is_link($pointer))throw new RuntimeException('ADMIN_UNAVAILABLE');$path=getenv('HORIZONS_LICENSE_CONFIG')?:require $pointer;if(!is_string($path)||is_link($path)||!is_file($path)||str_starts_with(realpath($path),$web.'/'))throw new RuntimeException('ADMIN_UNAVAILABLE');$c=require $path;foreach(['database_path','code_path','vault_path'] as $field){$real=realpath($c[$field]??'');if(!$real||str_starts_with($real,$web.'/'))throw new RuntimeException('ADMIN_UNAVAILABLE');}return $c;};
    $input=[];if($method==='POST'){
        if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new RuntimeException('FORBIDDEN');
        if(!str_starts_with($_SERVER['CONTENT_TYPE']??'','application/json')||(int)($_SERVER['CONTENT_LENGTH']??0)>16384)throw new RuntimeException('INVALID_REQUEST');
        $raw=file_get_contents('php://input',false,null,0,16385);if(!$raw||strlen($raw)>16384)throw new RuntimeException('INVALID_REQUEST');$input=json_decode($raw,true,12,JSON_THROW_ON_ERROR);if(!is_array($input)||array_is_list($input))throw new RuntimeException('INVALID_REQUEST');
    }
    $action=$method==='POST'?($input['action']??''):($_GET['action']??'state');if(!is_string($action))throw new RuntimeException('INVALID_REQUEST');
    if($action==='state'&&$method==='GET'){$result=['authenticated'=>$auth,'csrf'=>$_SESSION['csrf'],'owner_hint'=>'info@horizons-tr.com','collection_enabled'=>false];if($auth)$result+=['catalog'=>$catalog,'margin_bps'=>$settings['margin_bps']];}
    elseif($action==='request_login'&&$method==='POST'){
        $c=$loadConfig();require_once $c['code_path'].'/Core.php';require_once $dir.'/AdminMailer.php';$owner=json_decode(file_get_contents($dir.'/owner.json'),true,4,JSON_THROW_ON_ERROR);
        // Owner recipient is fixed in a private deployment file, never in request input.
        if(($owner['email']??'')!=='info@horizons-tr.com')throw new RuntimeException('ADMIN_UNAVAILABLE');
        $mailer=new \HorizonsAdmin\AdminMailer($c['smtp']);$id=$store->startLogin(session_id(),$_SERVER['REMOTE_ADDR']??'',time(),static fn($code)=>$mailer->code($owner['email'],$code));$result=['challenge'=>$id];
    }
    elseif($action==='verify_login'&&$method==='POST'){
        $store->verifyLogin(session_id(),\HorizonsAdmin\AdminStore::field($input,'challenge',32),\HorizonsAdmin\AdminStore::field($input,'code',8),$_SERVER['REMOTE_ADDR']??'',time());session_regenerate_id(true);$_SESSION['signed_at']=time();$_SESSION['last_seen']=time();$_SESSION['csrf']=bin2hex(random_bytes(32));$result=['authenticated'=>true,'csrf'=>$_SESSION['csrf']];
    }
    elseif($action==='logout'&&$method==='POST'){$_SESSION=[];session_destroy();$result=['authenticated'=>false];}
    else {
        if(!$auth)throw new RuntimeException('LOGIN_REQUIRED');
        if($method==='POST'&&$now-$_SESSION['signed_at']>900)throw new RuntimeException('REAUTH_REQUIRED');
        $page=filter_var($_GET['page']??0,FILTER_VALIDATE_INT);if($page===false||$page<0||$page>10000)throw new RuntimeException('INVALID_REQUEST');
        $id=is_string($input['id']??null)?$input['id']:'';
        if($action==='orders'&&$method==='GET')$result=$store->listing($page,is_string($_GET['search']??null)?substr($_GET['search'],0,100):'');
        elseif($action==='audit'&&$method==='GET')$result=['events'=>$store->query('SELECT action,target,created FROM admin_events ORDER BY id DESC LIMIT 50')->fetchAll(PDO::FETCH_ASSOC)];
        elseif($action==='reviews'&&$method==='GET'){
            $rows=[];$more=false;$path=$review.'/review-orders.sqlite';
            if(is_file($path)){$db=new PDO('sqlite:'.$path,null,null,[PDO::SQLITE_ATTR_OPEN_FLAGS=>PDO::SQLITE_OPEN_READONLY]);$db->exec('PRAGMA query_only=ON');$q=$db->prepare('SELECT reference,payload,created_at FROM review_orders ORDER BY created_at DESC,reference DESC LIMIT 31 OFFSET ?');$q->execute([$page*30]);$items=$q->fetchAll(PDO::FETCH_ASSOC);$more=count($items)>30;$k=file_get_contents($review.'/key.bin');foreach(array_slice($items,0,30) as $row){$v=base64_decode($row['payload'],true);$plain=sodium_crypto_secretbox_open(substr($v,24),substr($v,0,24),$k);if($plain===false)throw new RuntimeException('ADMIN_UNAVAILABLE');$rows[]=['id'=>$row['reference'],'created'=>$row['created_at'],'data'=>json_decode($plain,true,16,JSON_THROW_ON_ERROR)];}}
            $result=['reviews'=>$rows,'more'=>$more,'page'=>$page];
        }
        elseif($action==='customers'&&$method==='GET')$result=(new \HorizonsAdmin\AdminService($store,$loadConfig(),$web))->customers($page);
        elseif($action==='quote'&&$method==='POST')$result=['quote'=>$fx->quote($catalog,\HorizonsAdmin\AdminStore::field($input,'product',100),\HorizonsAdmin\AdminStore::field($input,'offer',100),\HorizonsAdmin\AdminStore::field($input,'currency',3),$now)];
        elseif($action==='create_order'&&$method==='POST')$result=['order'=>$store->create($input,$catalog,$fx,$now)];
        elseif($action==='record_payment'&&$method==='POST')$result=['order'=>$store->payment($id,$input)];
        elseif($action==='record_invoice'&&$method==='POST')$result=['order'=>$store->invoice($id,\HorizonsAdmin\AdminStore::field($input,'invoice',64),($input['issued']??false)===true)];
        elseif($action==='fulfil'&&$method==='POST')$result=['order'=>(new \HorizonsAdmin\AdminService($store,$loadConfig(),$web))->fulfil($id,\HorizonsAdmin\AdminStore::field($input,'email'),($input['confirmed']??false)===true)];
        elseif($action==='resend'&&$method==='POST')$result=(new \HorizonsAdmin\AdminService($store,$loadConfig(),$web))->resend($id);
        elseif($action==='settings'&&$method==='POST'){
            $margin=$input['margin_bps']??null;if(!is_int($margin)||$margin<0||$margin>1000)throw new RuntimeException('INVALID_MARGIN');
            $lock=fopen($dir.'/settings.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('ADMIN_UNAVAILABLE');try{$tmp=$review.'/fx-settings.json.'.bin2hex(random_bytes(4));file_put_contents($tmp,json_encode(['margin_bps'=>$margin],JSON_THROW_ON_ERROR));chmod($tmp,0600);rename($tmp,$review.'/fx-settings.json');$store->event('margin_changed',(string)$margin);}finally{flock($lock,LOCK_UN);fclose($lock);}$result=['margin_bps'=>$margin];
        }else throw new RuntimeException('INVALID_REQUEST');
    }
    echo json_encode(['ok'=>true]+$result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){
    $allowed=['LOGIN_REQUIRED','REAUTH_REQUIRED','FORBIDDEN','RATE_LIMITED','LOGIN_INVALID','MAIL_UNAVAILABLE','INVALID_INPUT','INVALID_REQUEST','EMAIL_MISMATCH','CONSENT_REQUIRED','PRODUCT_UNAVAILABLE','OFFER_UNAVAILABLE','REQUEST_REUSED','ORDER_NOT_FOUND','PAYMENT_CONFIRM_REQUIRED','AMOUNT_MISMATCH','RECEIPT_REUSED','INVOICE_REQUIRED','INVOICE_CONFLICT','PAYMENT_REQUIRED','ACTIVATION_CONFIRM_REQUIRED','ACTIVATION_REQUIRED','WORKER_BUSY','EMAIL_ALREADY_ASSIGNED','SUBSCRIPTION_ALREADY_ACTIVE','BANK_RECEIPT_REUSED','FX_UNAVAILABLE','FX_EXPIRED','FX_INVALID','INVALID_MARGIN'];
    $error=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'ADMIN_UNAVAILABLE';http_response_code(in_array($error,['LOGIN_REQUIRED','REAUTH_REQUIRED'],true)?401:($error==='FORBIDDEN'?403:($error==='RATE_LIMITED'?429:400)));echo json_encode(['ok'=>false,'error'=>$error]);
}
