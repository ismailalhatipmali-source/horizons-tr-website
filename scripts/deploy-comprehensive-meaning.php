<?php
declare(strict_types=1);
// Paired UI update: paid plaintext remains only in process memory, encrypted on disk.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/blending3-preservation.php';
require_once __DIR__.'/blending2-preservation.php';
require_once __DIR__.'/creator-public-preservation.php';
require_once __DIR__.'/comprehensive-meaning-preservation.php';
function hznCMWrite(string $path,string $raw,int $mode):void {
    $temp=$path.'.meaning-ui-'.bin2hex(random_bytes(6));try{if(file_put_contents($temp,$raw)!==strlen($raw)||!chmod($temp,$mode)||!rename($temp,$path))throw new RuntimeException('COMPREHENSIVE_WRITE_FAILED');}finally{if(is_file($temp))unlink($temp);}
}
function hznCMDecrypt(string $raw,string $key):string {
    $plain=strlen($raw)>28?openssl_decrypt(substr($raw,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,-16),'horizons-arabic-level1/workbook.js'):false;
    if($plain===false)throw new RuntimeException('COMPREHENSIVE_DECRYPT_FAILED');return $plain;
}
function hznCMRemovePrivate(string $private):void {
    foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$file=hznCMPath($private,'baseline/'.$name);if(is_file($file)&&!unlink($file))throw new RuntimeException('COMPREHENSIVE_CLEANUP_FAILED');}
    foreach(['baseline/learn/content/1.4.1','baseline/learn/content','baseline/learn','baseline/try','baseline'] as $name){$dir=hznCMPath($private,$name);if(is_dir($dir)&&!rmdir($dir))throw new RuntimeException('COMPREHENSIVE_CLEANUP_FAILED');}
    $receipt=hznCMPath($private,'receipt.json');if(is_file($receipt)&&!unlink($receipt))throw new RuntimeException('COMPREHENSIVE_CLEANUP_FAILED');
    if(is_dir($private)&&!rmdir($private))throw new RuntimeException('COMPREHENSIVE_CLEANUP_FAILED');
}
$private='';$privateCreated=false;$lock='';$locked=false;$written=[];$originals=[];$failed=false;$restoreFailed=false;
try{
    if(count($argv)<2||count($argv)>3||(isset($argv[2])&&$argv[2]!=='--publish'))throw new RuntimeException('COMPREHENSIVE_ARGUMENTS_INVALID');
    $input=rtrim($argv[1],'/');$repo=realpath(dirname(__DIR__));$web=realpath($input);
    if($input===''||is_link($input)||!$repo||!$web||!is_dir($web)||$web==='/'||$input!==$web||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('COMPREHENSIVE_ROOT_INVALID');
    $release=hznCMRelease($repo);$current=hznCMState($web);
    if($current!==null){hznB3State($web);hznBlending2SupersedingState($web);hznCreatorPublicState($web);echo "CURRENT: paired story meaning controls and 32-language free meanings verified.\n";exit;}
    $installed=hznB3State($web);$creator=hznCreatorPublicState($web);
    if(!$installed||!hznBlending2SupersedingState($web)||($installed['responsive_receipt']['patch']??'')!=='workbook-responsive-20261004-r3'||($creator['demo_experience']['patch']??'')!=='demo-experience-20261004-r1')throw new RuntimeException('COMPREHENSIVE_APPROVED_BASELINE_REQUIRED');
    $home=dirname($web);$before=$creator['demo_experience']['hashes'];$paid=$installed['responsive_receipt'];
    $before['learn/asset-manifest.json']=$paid['hashes']['asset-manifest.json'];$before['learn/content/1.4.1/workbook.js.hzn']=$paid['hashes']['content/1.4.1/workbook.js.hzn'];
    if(array_keys($before)!==HZN_COMPREHENSIVE_MEANING_PATHS)throw new RuntimeException('COMPREHENSIVE_BASELINE_SCOPE_INVALID');
    foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$path=hznCMPath($web,$name);$raw=hznCMRead($path);if(!hash_equals($before[$name],hash('sha256',$raw)))throw new RuntimeException('COMPREHENSIVE_BASELINE_CHANGED');$originals[$name]=['bytes'=>$raw,'mode'=>fileperms($path)&0777];}
    $payloads=[];foreach($release['files'] as $name=>$entry){$raw=hznCMRead(hznCMPath($repo,$entry['source']));if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hash('sha256',$raw))||$before[$name]!==$entry['before'])throw new RuntimeException('COMPREHENSIVE_PAYLOAD_CHANGED');$payloads[$name]=$raw;}
    $oldDemo=json_decode($originals['try/demo-asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);$newDemo=json_decode($payloads['try/demo-asset-manifest.json'],true,32,JSON_THROW_ON_ERROR);$projection=$newDemo;$projection['files']['workbook.js']=$oldDemo['files']['workbook.js'];
    if($projection!==$oldDemo)throw new RuntimeException('COMPREHENSIVE_DEMO_CONTENT_CHANGED');
    foreach(['try/index.html','learn/index.html','try/demo-experience.css'] as $name)if($payloads[$name]!==$originals[$name]['bytes'])throw new RuntimeException('COMPREHENSIVE_UNRELATED_UI_CHANGED');
    foreach(['try/sw.js'=>false,'learn/sw.js'=>true] as $name=>$paidWorker)if(hznCMWorker($originals[$name]['bytes'],$paidWorker)!==$payloads[$name])throw new RuntimeException('COMPREHENSIVE_WORKER_CHANGED');
    // The only paid source is a generic control, never lesson data or new translations.
    $story=hznCMRead(hznCMPath($repo,HZN_COMPREHENSIVE_MEANING_SOURCES[0]));
    if(substr_count($story,'/*STORY_MEANING_CONTROL_BEGIN*/')!==1||substr_count($story,'/*STORY_MEANING_CONTROL_END*/')!==1||str_contains($story,'/*HZN_DEMO_MEANINGS_LOCALES*/'))throw new RuntimeException('COMPREHENSIVE_STORY_HOOK_INVALID');
    $pointer=require hznCMPath($web,'activation/config-path.php');
    if(!is_string($pointer)||is_link($pointer)||!($configPath=realpath($pointer))||!str_starts_with($configPath,$home.'/')||str_starts_with($configPath,$web.'/'))throw new RuntimeException('COMPREHENSIVE_PRIVATE_CONFIG_REQUIRED');
    ob_start();try{$config=require $configPath;}finally{ob_end_clean();}
    $vaultPath=$config['vault_path']??'';
    if(!is_string($vaultPath)||is_link($vaultPath)||!($vaultReal=realpath($vaultPath))||!str_starts_with($vaultReal,$home.'/')||str_starts_with($vaultReal,$web.'/'))throw new RuntimeException('COMPREHENSIVE_PRIVATE_VAULT_REQUIRED');
    $vault=json_decode(hznCMRead($vaultReal),true,8,JSON_THROW_ON_ERROR);$key=base64_decode($vault['content_key']??'',true);
    if(($vault['product']??'')!=='horizons-arabic-level1'||!is_string($key)||strlen($key)!==32)throw new RuntimeException('COMPREHENSIVE_INVALID_VAULT');
    $plain=gzdecode(hznCMDecrypt($originals['learn/content/1.4.1/workbook.js.hzn']['bytes'],$key),33554432);
    $manifest=json_decode($originals['learn/asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);
    if($plain===false||strlen($plain)!==$manifest['files']['workbook.js']['decoded_bytes']||!hash_equals($paid['plain_after_sha256'],hash('sha256',$plain)))throw new RuntimeException('COMPREHENSIVE_PAID_APPLICATION_BASELINE_CHANGED');
    $tail="\ninit();\n\n})();";$extension="\n".rtrim($story,"\r\n")."\n";
    if(substr_count($plain,$tail)!==1||str_contains($plain,'/*STORY_MEANING_CONTROL_BEGIN*/'))throw new RuntimeException('COMPREHENSIVE_PAID_HOOK_CHANGED');
    $updated=str_replace($tail,$extension.$tail,$plain);
    if(str_replace($extension.$tail,$tail,$updated)!==$plain||strlen($updated)>33554432)throw new RuntimeException('COMPREHENSIVE_PAID_CONTENT_PRESERVATION_FAILED');
    $packed=gzencode($updated,9);if($packed===false)throw new RuntimeException('COMPREHENSIVE_COMPRESSION_FAILED');$nonce=random_bytes(12);$tag='';
    $cipher=openssl_encrypt($packed,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$nonce,$tag,'horizons-arabic-level1/workbook.js',16);
    if($cipher===false)throw new RuntimeException('COMPREHENSIVE_ENCRYPT_FAILED');$cipher=$nonce.$cipher.$tag;
    if(hznCMDecrypt($cipher,$key)!==$packed)throw new RuntimeException('COMPREHENSIVE_ENCRYPT_CHECK_FAILED');
    $payloads['learn/content/1.4.1/workbook.js.hzn']=$cipher;$manifest['files']['workbook.js']['sha256']=hash('sha256',$cipher);$manifest['files']['workbook.js']['bytes']=strlen($cipher);$manifest['files']['workbook.js']['decoded_bytes']=strlen($updated);
    $payloads['learn/asset-manifest.json']=hznCMJson($manifest)."\n";
    $plainBeforeSha=hash('sha256',$plain);$plainAfterSha=hash('sha256',$updated);
    // Release the large plaintext and key before nested preservation checks.
    unset($plain,$updated,$packed,$cipher,$key,$vault,$config);
    $inherited=[];foreach(HZN_COMPREHENSIVE_MEANING_RECEIPTS as $name)$inherited[$name]=hash('sha256',hznCMRead(hznCMPath($home,$name)));
    $hashes=[];$modes=[];foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$hashes[$name]=hash('sha256',$payloads[$name]);$modes[$name]=$originals[$name]['mode'];}
    if(($argv[2]??'')!=='--publish'){echo "READY: paired nine-file UI update; paid content encrypted; 100 approved free words and 10 stories in 32 languages.\n";exit;}
    $private=hznCMPath($home,'.horizons-comprehensive-meaning');if(file_exists($private))throw new RuntimeException('COMPREHENSIVE_PRIVATE_STATE_CONFLICT');
    // A lock shared by both sides prevents another paired deployment from writing.
    $lock=hznCMPath($home,'.horizons-comprehensive-meaning.lock');if(!mkdir($lock,0700))throw new RuntimeException('COMPREHENSIVE_DEPLOYMENT_BUSY');$locked=true;
    if(!mkdir($private,0700))throw new RuntimeException('COMPREHENSIVE_PRIVATE_STATE_FAILED');$privateCreated=true;if(!chmod($private,0700))throw new RuntimeException('COMPREHENSIVE_PRIVATE_STATE_FAILED');
    foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$backup=hznCMPath($private,'baseline/'.$name);if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('COMPREHENSIVE_BACKUP_FAILED');hznCMWrite($backup,$originals[$name]['bytes'],0600);if(!hash_equals($before[$name],hash_file('sha256',$backup)))throw new RuntimeException('COMPREHENSIVE_BACKUP_FAILED');}
    foreach(HZN_COMPREHENSIVE_MEANING_RECEIPTS as $name)if(!hash_equals($inherited[$name],hash('sha256',hznCMRead(hznCMPath($home,$name)))))throw new RuntimeException('COMPREHENSIVE_INHERITED_RECEIPT_CHANGED');
    foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$target=hznCMPath($web,$name);if(hznCMRead($target)!==$originals[$name]['bytes'])throw new RuntimeException('COMPREHENSIVE_TARGET_CHANGED');hznCMWrite($target,$payloads[$name],0644);$written[]=$name;}
    $receipt=['schema'=>1,'patch'=>HZN_COMPREHENSIVE_MEANING_RELEASE,'manifest_sha256'=>HZN_COMPREHENSIVE_MEANING_MANIFEST_SHA256,'sources'=>$release['input_sources'],'hashes'=>$hashes,'before_hashes'=>$before,'before_modes'=>$modes,'inherited_receipts'=>$inherited,'plain_before_sha256'=>$plainBeforeSha,'plain_after_sha256'=>$plainAfterSha,'worker_suffix'=>HZN_COMPREHENSIVE_MEANING_WORKER_SUFFIX];
    hznCMWrite(hznCMPath($private,'receipt.json'),hznCMJson($receipt)."\n",0600);
    hznCMState($web);hznB3State($web);hznBlending2SupersedingState($web);hznCreatorPublicState($web);
    echo "PUBLISHED: paired story meaning controls and 32-language free meanings; older releases, media and learner progress preserved.\n";
}catch(Throwable $error){
    foreach(array_reverse($written) as $name){try{hznCMWrite(hznCMPath($web,$name),$originals[$name]['bytes'],$originals[$name]['mode']);}catch(Throwable $ignored){$restoreFailed=true;}}
    $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'COMPREHENSIVE_PUBLISH_FAILED';fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; paired published changes rolled back')."\n");$failed=true;
}finally{
    if($failed&&$privateCreated&&!$restoreFailed){try{hznCMRemovePrivate($private);}catch(Throwable $ignored){$restoreFailed=true;fwrite(STDERR,"COMPREHENSIVE_CLEANUP_FAILED; RESTORE_REQUIRES_ATTENTION\n");}}
    if($locked&&is_dir($lock)&&!rmdir($lock)){fwrite(STDERR,"COMPREHENSIVE_LOCK_CLEANUP_FAILED\n");$failed=true;}
}
exit($failed?1:0);
