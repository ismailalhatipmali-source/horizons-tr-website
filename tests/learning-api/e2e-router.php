<?php
/** TEST ONLY. Never copy this file into a deployment or public document root. */
declare(strict_types=1);
if(PHP_SAPI!=='cli-server' || !in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true) || !preg_match('/^(127\.0\.0\.1|localhost)(:[0-9]+)?$/D',$_SERVER['HTTP_HOST']??'')){http_response_code(403);exit;}
$root=realpath(getenv('HZN_E2E_DOCROOT')?:'');
if(!$root || !str_starts_with($root,sys_get_temp_dir().'/horizons-') || basename($root)!=='public_html')throw new RuntimeException('Use an isolated /tmp/horizons-*/public_html fixture');
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
// A bounded, opt-in delay lets browser tests observe a pending encrypted audio
// request while interacting with the UI. This branch exists only in this router.
$delayName=$_COOKIE['hzn_fixture_delay']??'';
if(is_string($delayName) && preg_match('/^[A-Za-z0-9._-]{1,120}\.mp3\.hzn$/D',$delayName) && is_string($path) && str_starts_with($path,'/learn/content/') && basename($path)===$delayName)usleep(1500000);
if($path==='/__fixture__/activate'){
    header('Content-Type: application/json');header('Cache-Control: no-store');
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit;}
    try {
        $input=json_decode((string)file_get_contents('php://input'),true,8,JSON_THROW_ON_ERROR);
        if(!is_array($input) || !in_array($input['account']??null,['A','B'],true) || !is_string($input['device_id']??null) || !preg_match('/^[a-f0-9]{64}$/D',$input['device_id']) || !is_string($input['public_key']??null))throw new RuntimeException('Invalid fixture identity');
        $vault=realpath(getenv('HZN_E2E_VAULT')?:'');$activationCore=realpath(getenv('HZN_E2E_ACTIVATION_CORE')?:'');
        if(!$vault || !$activationCore || str_starts_with($vault,$root.'/'))throw new RuntimeException('External private fixture inputs are required');
        require_once $activationCore;
        $home=dirname($root);$private=$home.'/horizons-license';$marker=$private.'/E2E-SYNTHETIC-ONLY';
        if(is_dir($private) && !is_file($marker))throw new RuntimeException('Refusing an existing unmarked registry');
        $old=umask(0077);
        try{
            if(!is_dir($private)){mkdir($private,0700);file_put_contents($marker,'Synthetic loopback test registry');}
            if(!is_dir($root.'/activation'))mkdir($root.'/activation',0755);
            $database=$private.'/registry.sqlite';
            file_put_contents($private.'/config.php','<?php return '.var_export(['enabled'=>true,'database_path'=>$database],true).';');
            file_put_contents($root.'/activation/config-path.php','<?php return '.var_export($private.'/config.php',true).';');
            $db=new PDO('sqlite:'.$database,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $db->exec('CREATE TABLE IF NOT EXISTS entitlements(id TEXT PRIMARY KEY,email_hash TEXT,revoked INTEGER,account_id TEXT,channel TEXT,starts_at INTEGER,expires_at INTEGER);CREATE TABLE IF NOT EXISTS devices(entitlement_id TEXT,device TEXT,key_hash TEXT,PRIMARY KEY(entitlement_id,device));CREATE TABLE IF NOT EXISTS account_devices(account_id TEXT,device TEXT,key_hash TEXT,PRIMARY KEY(account_id,device));');
            if(!in_array($input['schema']??3,[2,3],true))throw new RuntimeException('Invalid fixture schema');
            $account='acct_fixture_'.$input['account'];$license='lic_fixture_'.$input['account'];$now=time();
            [$pub,$der]=\Horizons\Crypto::publicKey($input['public_key']);$keyHash=hash('sha256',$der);
            $db->exec('BEGIN IMMEDIATE');
            try{
                $q=$db->prepare('SELECT COUNT(*) FROM account_devices WHERE account_id=? AND device<>?');$q->execute([$account,$input['device_id']]);if((int)$q->fetchColumn()>=3)throw new RuntimeException('Fixture device limit');
                $q=$db->prepare('INSERT OR IGNORE INTO entitlements VALUES(?,?,0,?,?,?,NULL)');$q->execute([$license,hash('sha256',$account),$account,'direct',$now-100]);
                $q=$db->prepare('INSERT INTO devices VALUES(?,?,?) ON CONFLICT(entitlement_id,device) DO UPDATE SET key_hash=excluded.key_hash');$q->execute([$license,$input['device_id'],$keyHash]);
                $q=$db->prepare('INSERT INTO account_devices VALUES(?,?,?) ON CONFLICT(account_id,device) DO UPDATE SET key_hash=excluded.key_hash');$q->execute([$account,$input['device_id'],$keyHash]);
                $db->exec('COMMIT');
            }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
            $crypto=new \Horizons\Crypto(['data_key'=>base64_encode(random_bytes(32)),'vault_path'=>$vault]);
            $e=['id'=>$license,'account_id'=>$account,'plan'=>'lifetime','channel'=>'direct','starts_at'=>$now-100,'expires_at'=>null,'max_devices'=>3];
            $envelope=$crypto->license($e,$input['device_id'],$input['public_key'],'fixture-'.strtolower($input['account']).'@example.test',$now);
            if(($input['schema']??3)===2){
                $payload=json_decode(base64_decode($envelope['payload'],true),true,16,JSON_THROW_ON_ERROR);
                foreach(['account_id','plan','channel','starts_at','expires_at'] as $field)unset($payload[$field]);
                $payload['schema']=2;$raw=\Horizons\encoded($payload);
                $secrets=json_decode(file_get_contents($vault),true,16,JSON_THROW_ON_ERROR);
                $signing=base64_decode($secrets['signing_private_key'],true);
                $envelope=['payload'=>base64_encode($raw),'signature'=>base64_encode(sodium_crypto_sign_detached($raw,$signing))];
                sodium_memzero($signing);unset($secrets);
            }
            echo json_encode(['ok'=>true,'license'=>$envelope],JSON_THROW_ON_ERROR);
        }finally{umask($old);}
    }catch(Throwable $e){http_response_code(400);echo '{"ok":false,"error":"FIXTURE_SETUP_FAILED"}';}
    return;
}
if($path==='/learning-api/index.php'){
    // Loopback browser fixtures use HTTP. This substitution is confined to this
    // test router; production index.php still requires actual HTTPS.
    $_SERVER['HTTPS']='on';$_SERVER['DOCUMENT_ROOT']=$root;
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if($origin==='http://'.($_SERVER['HTTP_HOST']??''))$_SERVER['HTTP_ORIGIN']='https://'.$_SERVER['HTTP_HOST'];
    require __DIR__.'/../../src/learning-api/index.php';
    return;
}
return false;
