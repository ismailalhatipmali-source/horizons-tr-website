<?php
declare(strict_types=1);
// Publish only the 64 reviewed marketing paragraphs; never open secrets or app plaintext.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/demo-marketing-preservation.php';
require_once __DIR__.'/comprehensive-meaning-preservation.php';
function hznMCWrite(string $path,string $raw,int $mode):void {
    $temp=$path.'.marketing-'.bin2hex(random_bytes(6));try{if(file_put_contents($temp,$raw)!==strlen($raw)||!chmod($temp,$mode)||!rename($temp,$path))throw new RuntimeException('MARKETING_WRITE_FAILED');}finally{if(is_file($temp))unlink($temp);}
}
function hznMCRemovePrivate(string $private):void {
    foreach(hznMCPaths() as $relative){$file=hznMCPath($private,'baseline/'.$relative);if(is_file($file)&&!unlink($file))throw new RuntimeException('MARKETING_CLEANUP_FAILED');}
    foreach(HZN_DEMO_MARKETING_LANGUAGES as $language){$dir=hznMCPath($private,'baseline/'.$language);if(is_dir($dir)&&!rmdir($dir))throw new RuntimeException('MARKETING_CLEANUP_FAILED');}
    $dir=hznMCPath($private,'baseline');if(is_dir($dir)&&!rmdir($dir))throw new RuntimeException('MARKETING_CLEANUP_FAILED');$receipt=hznMCPath($private,'receipt.json');if(is_file($receipt)&&!unlink($receipt))throw new RuntimeException('MARKETING_CLEANUP_FAILED');if(is_dir($private)&&!rmdir($private))throw new RuntimeException('MARKETING_CLEANUP_FAILED');
}
$private='';$privateCreated=false;$lock='';$locked=false;$written=[];$originals=[];$failed=false;$restoreFailed=false;
try{
    if(count($argv)<2||count($argv)>3||(isset($argv[2])&&$argv[2]!=='--publish'))throw new RuntimeException('MARKETING_ARGUMENTS_INVALID');$input=rtrim($argv[1],'/');$repo=realpath(dirname(__DIR__));$web=realpath($input);
    if($input===''||is_link($input)||!$repo||!$web||!is_dir($web)||$web==='/'||$input!==$web||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('MARKETING_ROOT_INVALID');
    $release=hznMCRelease($repo);$current=hznMCState($web);if($current!==null){echo "CURRENT: 64 localized demo marketing paragraphs verified; app and old releases unchanged.\n";exit;}
    if(hznCMState($web)===null)throw new RuntimeException('MARKETING_APPROVED_APP_REQUIRED');$home=dirname($web);$paths=hznMCPaths();$payloads=[];$hashes=[];$before=[];$modes=[];
    foreach($paths as $relative){$entry=$release['files'][$relative];$target=hznMCPath($web,$relative);$old=hznMCRead($target);$new=hznMCRead(hznMCPath($repo,$entry['source']));
        if(!hash_equals($entry['before'],hash('sha256',$old)))throw new RuntimeException('MARKETING_PUBLIC_BASELINE_CHANGED');
        if(!hash_equals($entry['sha256'],hash('sha256',$new))||strlen($new)!==$entry['bytes']||hznMCReplace($old,$entry)!==$new)throw new RuntimeException('MARKETING_PAYLOAD_CHANGED');
        $originals[$relative]=['bytes'=>$old,'mode'=>fileperms($target)&0777];$payloads[$relative]=$new;$hashes[$relative]=$entry['sha256'];$before[$relative]=$entry['before'];$modes[$relative]=$originals[$relative]['mode'];
    }
    $inherited=[];foreach(HZN_DEMO_MARKETING_ANCESTORS as $relative)$inherited[$relative]=hash('sha256',hznMCRead(hznMCPath($home,$relative)));
    if(($argv[2]??'')!=='--publish'){echo "READY: 64 exact localized marketing paragraph replacements; app, audio, commerce and learner data untouched.\n";exit;}
    $private=hznMCPath($home,'.horizons-demo-marketing');if(file_exists($private))throw new RuntimeException('MARKETING_PRIVATE_STATE_CONFLICT');$lock=hznMCPath($home,'.horizons-demo-marketing.lock');if(!mkdir($lock,0700))throw new RuntimeException('MARKETING_DEPLOYMENT_BUSY');$locked=true;
    if(!mkdir($private,0700))throw new RuntimeException('MARKETING_PRIVATE_STATE_FAILED');$privateCreated=true;if(!chmod($private,0700))throw new RuntimeException('MARKETING_PRIVATE_STATE_FAILED');
    foreach($paths as $relative){$backup=hznMCPath($private,'baseline/'.$relative);if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('MARKETING_BACKUP_FAILED');hznMCWrite($backup,$originals[$relative]['bytes'],0600);if(!hash_equals($before[$relative],hash_file('sha256',$backup)))throw new RuntimeException('MARKETING_BACKUP_FAILED');}
    foreach(HZN_DEMO_MARKETING_ANCESTORS as $relative)if(!hash_equals($inherited[$relative],hash('sha256',hznMCRead(hznMCPath($home,$relative)))))throw new RuntimeException('MARKETING_INHERITED_RECEIPT_CHANGED');
    foreach($paths as $relative){$target=hznMCPath($web,$relative);if(hznMCRead($target)!==$originals[$relative]['bytes'])throw new RuntimeException('MARKETING_TARGET_CHANGED');hznMCWrite($target,$payloads[$relative],0644);$written[]=$relative;}
    $receipt=['schema'=>1,'patch'=>HZN_DEMO_MARKETING_RELEASE,'manifest_sha256'=>HZN_DEMO_MARKETING_MANIFEST_SHA256,'hashes'=>$hashes,'before_hashes'=>$before,'before_modes'=>$modes,'inherited_receipts'=>$inherited];
    hznMCWrite(hznMCPath($private,'receipt.json'),hznMCJson($receipt)."\n",0600);hznMCState($web);
    echo "PUBLISHED: demo descriptions updated in 32 languages; 64 exact paragraph changes; app, audio and old receipts preserved.\n";
}catch(Throwable $error){
    foreach(array_reverse($written) as $relative){try{hznMCWrite(hznMCPath($web,$relative),$originals[$relative]['bytes'],$originals[$relative]['mode']);}catch(Throwable $ignored){$restoreFailed=true;}}
    $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'MARKETING_PUBLISH_FAILED';fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published marketing changes rolled back')."\n");$failed=true;
}finally{
    if($failed&&$privateCreated&&!$restoreFailed){try{hznMCRemovePrivate($private);}catch(Throwable $ignored){$restoreFailed=true;fwrite(STDERR,"MARKETING_CLEANUP_FAILED; RESTORE_REQUIRES_ATTENTION\n");}}
    if($locked&&is_dir($lock)&&!rmdir($lock)){fwrite(STDERR,"MARKETING_LOCK_CLEANUP_FAILED\n");$failed=true;}
}
exit($failed?1:0);
