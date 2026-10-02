<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
try{
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off'){http_response_code(400);echo '{"ok":false,"error":"HTTPS_REQUIRED"}';exit;}
    if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);header('Allow: POST');echo '{"ok":false,"error":"METHOD_NOT_ALLOWED"}';exit;}
    if((int)($_SERVER['CONTENT_LENGTH']??0)>16384){http_response_code(413);echo '{"ok":false,"error":"INVALID_REQUEST"}';exit;}
    $path=getenv('HORIZONS_LICENSE_CONFIG')?:require __DIR__.'/config-path.php';if(!is_string($path)||!is_file($path))throw new RuntimeException('configuration unavailable');$config=require $path;
    $docroot=realpath($_SERVER['DOCUMENT_ROOT']??__DIR__);
    foreach([$path,$config['database_path'],$config['vault_path'],$config['code_path']] as $private){$absolute=realpath($private)?:realpath(dirname($private));if(!$absolute||($docroot&&($absolute===$docroot||str_starts_with($absolute,$docroot.DIRECTORY_SEPARATOR))))throw new RuntimeException('private path is public');}
    require $config['code_path'].'/bootstrap.php';$service=\Horizons\application($config);$route=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$base=rtrim($config['url_prefix']??'/activation','/');$ip=$_SERVER['REMOTE_ADDR']??'unknown';
    $raw=file_get_contents('php://input',false,null,0,16385);if($raw===false||strlen($raw)>16384)throw new \Horizons\ServiceError('INVALID_REQUEST');
    if($route===$base.'/v1/gumroad'||str_starts_with($route,$base.'/v1/gumroad/')){
        $provided=$route===$base.'/v1/gumroad'?($_SERVER['HTTP_X_HORIZONS_WEBHOOK_SECRET']??''):substr($route,strlen($base.'/v1/gumroad/'));\Horizons\authenticateWebhook($config['webhook_secret'],$provided);parse_str($raw,$input);
        $id=$input['sale_id']??'';$event=$input['event_id']??null;if(!is_string($id)||strlen($id)>120||($event!==null&&!is_string($event)))throw new \Horizons\ServiceError('INVALID_REQUEST');$service->synchronize($id,$event);$result=['ok'=>true];
    }else{
        if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))throw new \Horizons\ServiceError('INVALID_REQUEST',415);$input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);if(!is_array($input)||array_is_list($input))throw new \Horizons\ServiceError('INVALID_REQUEST');
        $memberRoute=str_starts_with($route,$base.'/v1/member/');$transferRoute=$route===$base.'/v1/transfer/create';
        if($memberRoute||$transferRoute){$origin=$_SERVER['HTTP_ORIGIN']??'';$expected='https://'.strtolower($_SERVER['HTTP_HOST']??'');if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'||($origin!==''&&strtolower($origin)!==$expected))throw new \Horizons\ServiceError('FORBIDDEN',403);}
        if($transferRoute){
            require_once $config['code_path'].'/commerce-bootstrap.php';[$checkout]=\Horizons\commerceApplication($config);
            try{$result=$checkout->create($input,$ip,time());}catch(RuntimeException $e){$allowed=['BILLING_INVALID','ACCOUNT_TYPE_INVALID','CONSENT_REQUIRED','EMAIL_CONFIRMATION_REQUIRED','PLAN_INVALID','CHECKOUT_NOT_READY','RATE_LIMITED','INVALID_REQUEST','REQUEST_REUSED','EMAIL_ALREADY_ASSIGNED','SUBSCRIPTION_ALREADY_ACTIVE'];$reason=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'SERVICE_UNAVAILABLE';throw new \Horizons\ServiceError($reason,$reason==='RATE_LIMITED'?429:($reason==='SERVICE_UNAVAILABLE'?503:400));}
        }elseif($memberRoute){
            [$membership,$members,$bridge]=\Horizons\membershipApplication($config);$action=substr($route,strlen($base.'/v1/member/'));
            if(in_array($action,['resend','check-code','setup','challenge','authenticate'],true))$result=match($action){'resend'=>$membership->resend($input,$ip),'check-code'=>$membership->checkCode($input,$ip),'setup'=>$membership->setup($input,$ip),'challenge'=>$membership->challenge($input,$ip),'authenticate'=>$membership->authenticate($input,$ip)};
            else{
                $header=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';$token=preg_match('/^Bearer ([a-f0-9]{64})$/D',$header,$m)?$m[1]:'';$actor=$membership->session($token);
                try{
                    if($action==='invite'){if(!is_string($input['email']??null)||!is_string($input['confirmation']??null))throw new \Horizons\ServiceError('INVALID_REQUEST');$members->invite($actor['group_id'],$actor['account_id'],$input['email'],$input['confirmation'],($input['permanent_acknowledged']??false)===true,time());}
                    elseif($action==='remove'){if(!is_string($input['member_id']??null))throw new \Horizons\ServiceError('INVALID_REQUEST');$members->remove($actor['group_id'],$actor['account_id'],$input['member_id'],time());}
                    elseif($action!=='list')throw new \Horizons\ServiceError('NOT_FOUND',404);
                    if($action!=='list')$members->work($bridge,time());$result=['ok'=>true]+$members->policy($actor['group_id'],$actor['account_id'],time());
                }catch(RuntimeException $e){if($e instanceof \Horizons\ServiceError)throw $e;$allowed=['MEMBERSHIP_FORBIDDEN','MEMBERSHIP_EXPIRED','EMAIL_PERMANENT','EMAIL_CONFIRMATION_REQUIRED','PERMANENT_EMAIL_ACK_REQUIRED','LEARNER_LIMIT','EMAIL_ALREADY_ASSIGNED','MEMBER_NOT_FOUND','EMAIL_INVALID'];throw new \Horizons\ServiceError(in_array($e->getMessage(),$allowed,true)?$e->getMessage():'SERVICE_UNAVAILABLE',in_array($e->getMessage(),$allowed,true)?409:503);}
            }
        }else{$result=match($route){$base.'/v1/auth/request'=>$service->request($input,$ip),$base.'/v1/auth/verify'=>$service->verify($input,$ip),$base.'/v1/auth/password'=>$service->passwordLogin($input,$ip),default=>throw new \Horizons\ServiceError('NOT_FOUND',404)};}
    }
    echo \Horizons\encoded($result);
}catch(Throwable $e){$expected=$e instanceof \Horizons\ServiceError;http_response_code($expected?$e->httpStatus:503);echo json_encode(['ok'=>false,'error'=>$expected?$e->reason:'SERVICE_UNAVAILABLE']);}
