<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
$written=[];$temps=[];$lock='';$locked=false;
function hznSafe(string $root,string $path):string{
    if(!preg_match('~^[A-Za-z0-9][A-Za-z0-9_./-]*$~D',$path)||str_contains('/'.$path.'/','/../')||str_contains('/'.$path.'/','/./')||str_contains($path,'//')||str_ends_with($path,'/'))throw new RuntimeException('INVALID_PATH');
    $current=rtrim($root,'/');
    foreach(explode('/',$path) as $part){$current.='/'.$part;if(is_link($current))throw new RuntimeException('SYMLINK_REJECTED');}
    if(file_exists($current)&&!is_file($current))throw new RuntimeException('FILE_CONFLICT');
    return $current;
}
function hznDigest(string $path):?string{return is_file($path)?hash_file('sha256',$path):null;}
function hznBlobMatches(string $path,string $sha):bool{
    if(!is_file($path))return false;$bytes=file_get_contents($path);if($bytes===false)return false;
    return hash_equals($sha,sha1('blob '.strlen($bytes)."\0".$bytes));
}
try{
    if(PHP_VERSION_ID<80200)throw new RuntimeException('PHP_82_REQUIRED');
    foreach(['pdo_sqlite','sodium','openssl'] as $ext)if(!extension_loaded($ext))throw new RuntimeException('MISSING_PHP_EXTENSION');
    $repo=realpath(dirname(__DIR__));$input=$argv[1]??'';$web=realpath($input);
    if(!$repo||!$web||!is_dir($web)||is_link($input)||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('INVALID_ROOT');
    $home=realpath(dirname($web));if(!$home)throw new RuntimeException('INVALID_ROOT');
    $private=$home.'/horizons-checkout-review';
    if(is_link($private)||!is_dir($private)||!is_file($private.'/key.bin')||filesize($private.'/key.bin')!==32||!is_file($private.'/products.json'))throw new RuntimeException('CHECKOUT_UPDATE_REQUIRED');
    $state=$home.'/.horizons-deploy-'.basename($web);
    if(is_link($state)||(file_exists($state)&&!is_dir($state)))throw new RuntimeException('STATE_FAILED');
    if(!is_dir($state)&&!mkdir($state,0700))throw new RuntimeException('STATE_FAILED');
    $lock=$state.'/deploy.lock';if(!@mkdir($lock,0700))throw new RuntimeException('DEPLOYMENT_ALREADY_RUNNING');$locked=true;

    $files=[
      ['public','dist/home.js','home.js','git-sha1:2a0ad467ec6b80cb63154de761548496b06a8918'],
      ['public','dist/products.json','products.json','git-sha1:01e60cae6b45ade0555aebf1db0ea9345d3fa727'],
      ['private','src/commerce/products.json','products.json','git-sha1:01e60cae6b45ade0555aebf1db0ea9345d3fa727'],
      ['private','src/checkout/ManualOrders.php','ManualOrders.php',null],
      ['private','src/checkout/ManualOrderMailer.php','ManualOrderMailer.php',null],
      ['public','src/checkout/manual-order-index.php','manual-order-api/index.php',null],
      ['public','dist/manual-order.html','manual-order.html',null],
      ['public','dist/manual-order.css','manual-order.css',null],
      ['public','dist/manual-order.js','manual-order.js',null],
      ['public','dist/manual-order-locales.json','manual-order-locales.json',null],
      ['public','dist/travel-kit.html','travel-kit.html',null],
      ['public','dist/travel-kit.css','travel-kit.css',null],
      ['public','dist/travel-kit.js','travel-kit.js',null],
    ];
    foreach(['en','ar','tr','fr','es','de','it','pt','nl','ru','uk','pl','cs','ro','hu','el','sv','da','no','fi','bg','sr','hr','he','fa','ur','hi','bn','id','ms','zh','ja'] as $lang){
        $files[]=['public','dist/assets/covers/'.$lang.'/travel-kit.svg','assets/covers/'.$lang.'/travel-kit.svg',null];
    }

    $changes=[];$total=0;
    foreach($files as [$scope,$sourceRel,$targetRel,$before]){
        $source=hznSafe($repo,$sourceRel);
        if(!is_file($source)||filesize($source)<1||filesize($source)>2097152)throw new RuntimeException('SOURCE_INVALID');
        $target=hznSafe($scope==='private'?$private:$web,$targetRel);$sourceHash=hznDigest($source);$current=hznDigest($target);
        $total+=filesize($source);if($total>20*1024*1024)throw new RuntimeException('PAYLOAD_TOO_LARGE');
        if($current!==null&&hash_equals($current,$sourceHash))continue;
        if($before===null){if($current!==null)throw new RuntimeException('TARGET_ALREADY_EXISTS');}
        elseif(str_starts_with($before,'git-sha1:')){
            $sha=substr($before,9);if(!preg_match('/^[a-f0-9]{40}$/D',$sha)||!hznBlobMatches($target,$sha))throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
        }else throw new RuntimeException('INVALID_BASELINE');
        $changes[]=[$scope,$source,$target,$targetRel,$current,$sourceHash];
    }
    if(($argv[2]??'')!=='--publish'){echo 'READY: '.count($changes)." Travel Kit files require publication. Manual-order storage will be private.\n";exit;}
    if(!$changes){echo "CURRENT: Travel Kit manual-order release already published.\n";exit;}

    $backup=$state.'/travel-kit-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));if(!mkdir($backup,0700))throw new RuntimeException('BACKUP_FAILED');
    foreach($changes as [$scope,$source,$target,$targetRel,$prior,$expected]){
        $save=$backup.'/'.$scope.'/'.$targetRel;
        if($prior!==null){if(!is_dir(dirname($save))&&!mkdir(dirname($save),0700,true))throw new RuntimeException('BACKUP_FAILED');if(!copy($target,$save)||hznDigest($save)!==$prior)throw new RuntimeException('BACKUP_FAILED');}
        if(!is_dir(dirname($target))){
            $dirMode=$scope==='private'?0700:0755;if(!mkdir(dirname($target),$dirMode,true)||!chmod(dirname($target),$dirMode))throw new RuntimeException('DIRECTORY_FAILED');
        }
        $temp=$target.'.hzn-new-'.bin2hex(random_bytes(4));$temps[]=$temp;$mode=$scope==='private'?0600:0644;
        if(!copy($source,$temp)||hznDigest($temp)!==$expected||!chmod($temp,$mode))throw new RuntimeException('STAGING_FAILED');
        if(hznDigest($target)!==$prior)throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
        if(!rename($temp,$target))throw new RuntimeException('REPLACE_FAILED');
        $written[]=[$target,$prior!==null,$save,$mode];
    }
    file_put_contents($backup.'/restore-map.json',json_encode($written,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
    echo 'PUBLISHED Travel Kit manual-order release: '.count($written).' files. No card collection enabled; fulfilment remains manual by email. Backup: '.basename($backup)."\n";
}catch(Throwable $e){
    $restoreFailed=false;
    foreach(array_reverse($written) as [$target,$hadPrior,$save,$mode]){
        if($hadPrior){$temp=$target.'.hzn-restore';if(!copy($save,$temp)||!chmod($temp,$mode)||!rename($temp,$target))$restoreFailed=true;}
        elseif(is_file($target)&&!unlink($target))$restoreFailed=true;
    }
    $reason=$e instanceof RuntimeException&&preg_match('/^[A-Z0-9_]+$/D',$e->getMessage())?$e->getMessage():'PUBLISH_FAILED';
    fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published changes rolled back')."\n");exit(1);
}finally{
    foreach($temps as $temp)if(is_file($temp))@unlink($temp);
    if($locked)@rmdir($lock);
}
