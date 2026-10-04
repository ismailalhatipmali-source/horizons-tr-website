<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/pricing-cards-preservation.php';
require_once __DIR__.'/demo-marketing-preservation.php';
function hznPCWrite(string $path,string $raw,int $mode):void {
    $temporary=$path.'.pricing-'.bin2hex(random_bytes(6));
    try{if(file_put_contents($temporary,$raw)!==strlen($raw)||!chmod($temporary,$mode)||!rename($temporary,$path))throw new RuntimeException('PRICING_WRITE_FAILED');}
    finally{if(is_file($temporary))unlink($temporary);}
}
function hznPCCleanup(string $private,array $paths):void {
    foreach($paths as $relative){$path=hznPCPath($private,'baseline/'.$relative);if(is_file($path)&&!unlink($path))throw new RuntimeException('PRICING_CLEANUP_FAILED');}
    foreach(array_unique(array_map(fn($path)=>dirname($path),$paths)) as $relative)if($relative!=='.'){
        $directory=hznPCPath($private,'baseline/'.$relative);if(is_dir($directory)&&!rmdir($directory))throw new RuntimeException('PRICING_CLEANUP_FAILED');
    }
    $baseline=hznPCPath($private,'baseline');if(is_dir($baseline)&&!rmdir($baseline))throw new RuntimeException('PRICING_CLEANUP_FAILED');
    $receipt=hznPCPath($private,'receipt.json');if(is_file($receipt)&&!unlink($receipt))throw new RuntimeException('PRICING_CLEANUP_FAILED');
    if(is_dir($private)&&!rmdir($private))throw new RuntimeException('PRICING_CLEANUP_FAILED');
}
$written=[];$originals=[];$private='';$lock='';$locked=false;$created=false;$failed=false;$restoreFailed=false;$paths=[];
try{
    if(count($argv)<2||count($argv)>3||(isset($argv[2])&&$argv[2]!=='--publish'))throw new RuntimeException('PRICING_ARGUMENTS_INVALID');
    $input=rtrim($argv[1],'/');$web=realpath($input);$repo=realpath(dirname(__DIR__));
    if(!$web||!$repo||$web!==$input||$web==='/'||!is_dir($web)||is_link($input)
       ||str_starts_with($web.'/',$repo.'/')||str_starts_with($repo.'/',$web.'/'))throw new RuntimeException('PRICING_ROOT_INVALID');
    $manifest=hznPCManifest($repo);$current=hznPCState($web);
    if($current!==null){echo "CURRENT: 32-language plan cards and descriptions verified.\n";exit;}
    if(hznMCState($web)===null)throw new RuntimeException('PRICING_MARKETING_REQUIRED');
    $marketingReceipt=hznPCPath(dirname($web),'.horizons-demo-marketing/receipt.json');
    $marketingSha=hash('sha256',hznPCRead($marketingReceipt,65536));
    $paths=array_keys($manifest['files']);$sources=[];
    foreach($manifest['files'] as $relative=>$entry){
        $target=hznPCPath($web,$relative);$raw=hznPCRead($target,524288);
        if(!hash_equals($entry['before'],hash('sha256',$raw)))throw new RuntimeException('PRICING_PUBLIC_BASELINE_CHANGED');
        $sources[$relative]=hznPCRead(hznPCPath($repo,$entry['source']),524288);$originals[$relative]=['raw'=>$raw,'mode'=>fileperms($target)&0777];
    }
    if(($argv[2]??'')!=='--publish'){echo "READY: 100 scoped pricing pages/assets; prior marketing, checkout and workbook verified.\n";exit;}
    $home=dirname($web);$private=hznPCPath($home,'.horizons-pricing-cards');$lock=hznPCPath($home,'.horizons-pricing-cards.lock');
    if(file_exists($private)||is_link($private))throw new RuntimeException('PRICING_PRIVATE_CONFLICT');
    if(!mkdir($lock,0700))throw new RuntimeException('PRICING_DEPLOYMENT_BUSY');$locked=true;
    if(!mkdir($private,0700))throw new RuntimeException('PRICING_PRIVATE_CREATE_FAILED');$created=true;
    foreach($paths as $relative){
        $backup=hznPCPath($private,'baseline/'.$relative);
        if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('PRICING_BACKUP_CREATE_FAILED');
        hznPCWrite($backup,$originals[$relative]['raw'],0600);
        if(!hash_equals($manifest['files'][$relative]['before'],hash('sha256',hznPCRead($backup,524288))))throw new RuntimeException('PRICING_BACKUP_CHANGED');
    }
    if(!hash_equals($marketingSha,hash('sha256',hznPCRead($marketingReceipt,65536))))throw new RuntimeException('PRICING_MARKETING_CHANGED');
    foreach($paths as $relative){
        $target=hznPCPath($web,$relative);if(hznPCRead($target,524288)!==$originals[$relative]['raw'])throw new RuntimeException('PRICING_TARGET_CHANGED');
        hznPCWrite($target,$sources[$relative],0644);$written[]=$relative;
    }
    $receipt=['schema'=>1,'version'=>HZN_PC_VERSION,'manifest_sha256'=>HZN_PC_MANIFEST_SHA256,
        'marketing_receipt_sha256'=>$marketingSha,'hashes'=>[],'before_hashes'=>[]];
    foreach($manifest['files'] as $relative=>$entry){$receipt['hashes'][$relative]=$entry['sha256'];$receipt['before_hashes'][$relative]=$entry['before'];}
    hznPCWrite(hznPCPath($private,'receipt.json'),json_encode($receipt,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n",0600);
    hznPCState($web);
    echo "PUBLISHED: plan details and corrected workbook description in 32 languages; no payments or learner data changed.\n";
}catch(Throwable $error){
    foreach(array_reverse($written) as $relative)try{hznPCWrite(hznPCPath($web,$relative),$originals[$relative]['raw'],$originals[$relative]['mode']);}catch(Throwable $ignored){$restoreFailed=true;}
    $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'PRICING_DEPLOY_FAILED';
    fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published pricing changes rolled back')."\n");$failed=true;
}finally{
    if($failed&&$created&&!$restoreFailed)try{hznPCCleanup($private,$paths);}catch(Throwable $ignored){$restoreFailed=true;fwrite(STDERR,"PRICING_CLEANUP_FAILED; RESTORE_REQUIRES_ATTENTION\n");}
    if($locked&&is_dir($lock)&&!rmdir($lock)){fwrite(STDERR,"PRICING_LOCK_CLEANUP_FAILED\n");$failed=true;}
}
exit($failed?1:0);
