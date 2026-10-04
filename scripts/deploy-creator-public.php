<?php
declare(strict_types=1);
// Fixed five-file public creator attribution overlay. No private keys or lesson data.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/creator-public-preservation.php';
function hznCreatorPublicWrite(string $path,string $raw,int $mode):void {
    $tmp=$path.'.creator-'.bin2hex(random_bytes(6));try{if(file_put_contents($tmp,$raw)!==strlen($raw)||!chmod($tmp,$mode)||!rename($tmp,$path))throw new RuntimeException('CREATOR_WRITE_FAILED');}finally{if(is_file($tmp))unlink($tmp);}
}
$locked=false;$lock='';$written=[];$originals=[];$failed=false;$private='';$privateCreated=false;$restoreFailed=false;
try{
    $repo=realpath(dirname(__DIR__));$input=$argv[1]??'';
    if(is_link($input)||!($web=realpath($input))||!is_dir($web)||!$repo||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('CREATOR_ROOT_INVALID');
    $manifestPath=hznCreatorPublicPath($repo,'release-assets/'.HZN_CREATOR_PUBLIC_RELEASE.'/manifest.json');$manifestRaw=hznCreatorPublicRead($manifestPath);$manifest=json_decode($manifestRaw,true,16,JSON_THROW_ON_ERROR);
    $allowed=['try/index.html'=>'src/demo-pwa/index.html','try/workbook.js'=>'src/demo-pwa/workbook.js','try/sw.js'=>'src/demo-pwa/sw.js','learn/index.html'=>'src/workbook-web/index.html','try/demo-asset-manifest.json'=>'release-assets/'.HZN_CREATOR_PUBLIC_RELEASE.'/files/try/demo-asset-manifest.json'];
    if(($manifest['schema']??null)!==1||($manifest['version']??'')!==HZN_CREATOR_PUBLIC_RELEASE||array_keys($manifest['files']??[])!==HZN_CREATOR_PUBLIC_PATHS||($manifest['demo_curriculum_count']??0)!==497
        ||count($manifest['interface_languages']??[])!==32||count(array_unique($manifest['interface_languages']??[]))!==32
        ||array_keys($manifest['shared_sources']??[])!==['src/workbook-web/creator-credit-locales.json','src/workbook-web/creator-credit.js'])throw new RuntimeException('CREATOR_MANIFEST_INVALID');
    foreach($manifest['shared_sources'] as $relative=>$sha)if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznCreatorPublicRead(hznCreatorPublicPath($repo,$relative)))))throw new RuntimeException('CREATOR_SHARED_SOURCE_CHANGED');
    $payloads=[];$total=0;
    foreach($allowed as $relative=>$source){
        $entry=$manifest['files'][$relative];if(($entry['source']??'')!==$source||!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>2097152||!preg_match('/^[a-f0-9]{64}$/D',$entry['sha256']??'')||!preg_match('/^[a-f0-9]{64}$/D',$entry['before']??''))throw new RuntimeException('CREATOR_SOURCE_INVALID');
        $raw=hznCreatorPublicRead(hznCreatorPublicPath($repo,$source));$total+=strlen($raw);if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hash('sha256',$raw))||$total>2097152)throw new RuntimeException('CREATOR_SOURCE_CHANGED');$payloads[$relative]=$raw;
    }
    $current=hznCreatorPublicState($web);if($current){if(!hash_equals($current['manifest_sha256'],hash('sha256',$manifestRaw)))throw new RuntimeException('CREATOR_DIFFERENT_RELEASE_INSTALLED');echo "CURRENT: creator attribution verified; 32 languages; 497 demo curriculum/media preserved.\n";exit;}
    foreach($allowed as $relative=>$source){$target=hznCreatorPublicPath($web,$relative);$raw=hznCreatorPublicRead($target);if(!hash_equals($manifest['files'][$relative]['before'],hash('sha256',$raw)))throw new RuntimeException('CREATOR_PUBLIC_BASELINE_CHANGED');$originals[$relative]=['bytes'=>$raw,'mode'=>fileperms($target)&0777];}
    $baseline=json_decode($originals['try/demo-asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);$demo=json_decode($payloads['try/demo-asset-manifest.json'],true,32,JSON_THROW_ON_ERROR);$projection=$demo;foreach(['index.html','workbook.js']as$name)$projection['files'][$name]=$baseline['files'][$name];
    if($projection!==$baseline||($demo['version']??'')!=='1.4.5'||($demo['edition']??'')!=='demo'||($demo['chapterIds']??[])!==$manifest['chapter_ids'])throw new RuntimeException('CREATOR_DEMO_CONTENT_CHANGED');
    foreach(['index.html','workbook.js']as$name)if(($demo['files'][$name]['sha256']??'')!==$manifest['files']['try/'.$name]['sha256']||($demo['files'][$name]['bytes']??0)!==$manifest['files']['try/'.$name]['bytes'])throw new RuntimeException('CREATOR_DEMO_MANIFEST_INVALID');
    if(($argv[2]??'')!=='--publish'){echo "READY: five public creator UI files; 32 languages; demo and activation baselines exact.\n";exit;}
    $private=hznCreatorPublicPath(dirname($web),'.horizons-creator-public');if(file_exists($private))throw new RuntimeException('CREATOR_PRIVATE_STATE_CONFLICT');
    if(!mkdir($private,0700))throw new RuntimeException('CREATOR_PRIVATE_STATE_FAILED');$privateCreated=true;if(!chmod($private,0700))throw new RuntimeException('CREATOR_PRIVATE_STATE_FAILED');
    $lock=hznCreatorPublicPath($private,'deploy.lock');if(!mkdir($lock,0700))throw new RuntimeException('CREATOR_DEPLOYMENT_BUSY');$locked=true;
    foreach(HZN_CREATOR_PUBLIC_PATHS as$relative){$backup=hznCreatorPublicPath($private,'baseline/'.$relative);if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('CREATOR_BACKUP_FAILED');hznCreatorPublicWrite($backup,$originals[$relative]['bytes'],0600);if(!hash_equals($manifest['files'][$relative]['before'],hash_file('sha256',$backup)))throw new RuntimeException('CREATOR_BACKUP_FAILED');}
    foreach(HZN_CREATOR_PUBLIC_PATHS as$relative){$target=hznCreatorPublicPath($web,$relative);if(!hash_equals($manifest['files'][$relative]['before'],hash_file('sha256',$target)))throw new RuntimeException('CREATOR_PUBLIC_BASELINE_CHANGED');hznCreatorPublicWrite($target,$payloads[$relative],0644);$written[]=$relative;}
    $hashes=[];$before=[];foreach(HZN_CREATOR_PUBLIC_PATHS as$relative){$hashes[$relative]=$manifest['files'][$relative]['sha256'];$before[$relative]=$manifest['files'][$relative]['before'];}
    hznCreatorPublicWrite(hznCreatorPublicPath($private,'receipt.json'),hznCreatorPublicJson(['schema'=>1,'patch'=>HZN_CREATOR_PUBLIC_RELEASE,'manifest_sha256'=>hash('sha256',$manifestRaw),'hashes'=>$hashes,'before_hashes'=>$before])."\n",0600);
    hznCreatorPublicState($web);echo "PUBLISHED: creator attribution in full entry and five-letter demo; 32 languages; 497 curriculum/media preserved.\n";
}catch(Throwable$error){
    $restoreFailed=false;foreach(array_reverse($written)as$relative){try{hznCreatorPublicWrite(hznCreatorPublicPath($web,$relative),$originals[$relative]['bytes'],$originals[$relative]['mode']);}catch(Throwable$restore){$restoreFailed=true;}}
    if($privateCreated&&!$restoreFailed&&is_file($private.'/receipt.json'))unlink($private.'/receipt.json');
    $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'CREATOR_PUBLISH_FAILED';fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published changes rolled back')."\n");$failed=true;
}finally{
    if($locked&&is_dir($lock))rmdir($lock);
    // Cleanup only the private directory created by this invocation, and only
    // after public rollback succeeded. Unknown files and recovery backups stay.
    if($failed&&$privateCreated&&!$restoreFailed){
        foreach(HZN_CREATOR_PUBLIC_PATHS as$relative){$backup=hznCreatorPublicPath($private,'baseline/'.$relative);if(is_file($backup))unlink($backup);}
        foreach(['baseline/try','baseline/learn','baseline']as$relative){$directory=hznCreatorPublicPath($private,$relative);if(is_dir($directory))rmdir($directory);}
        if(is_dir($private))rmdir($private);
    }
}
exit($failed?1:0);
