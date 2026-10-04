<?php
declare(strict_types=1);
// Publish only the seven reviewed public UI files; no vault or private app access.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/creator-public-preservation.php';
require_once __DIR__.'/demo-experience-preservation.php';
function hznDemoExperienceWrite(string $path,string $raw,int $mode):void {
    $tmp=$path.'.demo-ui-'.bin2hex(random_bytes(6));try{if(file_put_contents($tmp,$raw)!==strlen($raw)||!chmod($tmp,$mode)||!rename($tmp,$path))throw new RuntimeException('DEMO_WRITE_FAILED');}finally{if(is_file($tmp))unlink($tmp);}
}
$private='';$privateCreated=false;$written=[];$originals=[];$failed=false;$restoreFailed=false;$locked=false;$lock='';
try{
    $repo=realpath(dirname(__DIR__));$input=$argv[1]??'';
    if(is_link($input)||!($web=realpath($input))||!is_dir($web)||!$repo||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('DEMO_ROOT_INVALID');
    $releaseRoot='release-assets/'.HZN_DEMO_EXPERIENCE_RELEASE;
    $manifestRaw=hznCreatorPublicRead(hznCreatorPublicPath($repo,$releaseRoot.'/manifest.json'));$manifest=json_decode($manifestRaw,true,16,JSON_THROW_ON_ERROR);
    if(($manifest['schema']??null)!==1||($manifest['version']??'')!==HZN_DEMO_EXPERIENCE_RELEASE
        ||array_keys($manifest['files']??[])!==HZN_DEMO_EXPERIENCE_PATHS||($manifest['demo_curriculum_count']??0)!==497
        ||count($manifest['interface_languages']??[])!==32||count(array_unique($manifest['interface_languages']??[]))!==32
        ||array_keys($manifest['input_sources']??[])!==['src/demo-pwa/index.html','src/demo-pwa/workbook.js','src/demo-pwa/sw.js','src/workbook-web/index.html','src/demo-pwa/demo-experience.css','src/demo-pwa/demo-experience.js','src/demo-pwa/demo-experience-locales.json','src/demo-pwa/demo-letter-overview.json','release-assets/demo-experience-20261004-r1/baseline-learn-sw.js'])throw new RuntimeException('DEMO_RELEASE_INVALID');
    foreach($manifest['input_sources'] as $relative=>$sha)if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznCreatorPublicRead(hznCreatorPublicPath($repo,$relative)))))throw new RuntimeException('DEMO_SOURCE_REVISION_CHANGED');
    $payloads=[];$total=0;
    foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative){
        $entry=$manifest['files'][$relative];$source=$releaseRoot.'/files/'.$relative;$before=HZN_DEMO_BASELINE_HASHES[$relative];
        if(($entry['source']??'')!==$source||($entry['before']??null)!==$before||!array_key_exists('before',$entry)
            ||!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>2097152||!preg_match('/^[a-f0-9]{64}$/D',$entry['sha256']??''))throw new RuntimeException('DEMO_PAYLOAD_INVALID');
        $raw=hznCreatorPublicRead(hznCreatorPublicPath($repo,$source));$total+=strlen($raw);
        if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hash('sha256',$raw))||$total>2097152)throw new RuntimeException('DEMO_PAYLOAD_CHANGED');$payloads[$relative]=$raw;
    }
    $creator=hznCreatorPublicState($web);if($creator===null)throw new RuntimeException('APPROVED_CREATOR_RELEASE_REQUIRED');
    if(isset($creator['demo_experience'])){
        if(!hash_equals($creator['demo_experience']['manifest_sha256'],hash('sha256',$manifestRaw)))throw new RuntimeException('DEMO_DIFFERENT_RELEASE_INSTALLED');
        echo "CURRENT: demo experience verified; 32 languages; 497 curriculum/media preserved.\n";exit;
    }
    if($creator['hashes']!==HZN_DEMO_CREATOR_HASHES||$creator['manifest_sha256']!==HZN_DEMO_CREATOR_MANIFEST_SHA256)throw new RuntimeException('DEMO_CREATOR_BASELINE_CHANGED');
    $creatorPath=hznCreatorPublicPath(dirname($web),'.horizons-creator-public/receipt.json');$creatorReceiptSha=hash_file('sha256',$creatorPath);
    foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative){
        $target=hznCreatorPublicPath($web,$relative);$before=HZN_DEMO_BASELINE_HASHES[$relative];
        if($before===null){if(file_exists($target))throw new RuntimeException('DEMO_NEW_ASSET_CONFLICT');$originals[$relative]=['bytes'=>null,'mode'=>null];}
        else{$raw=hznCreatorPublicRead($target);if(!hash_equals($before,hash('sha256',$raw)))throw new RuntimeException('DEMO_PUBLIC_BASELINE_CHANGED');$originals[$relative]=['bytes'=>$raw,'mode'=>fileperms($target)&0777];}
    }
    $old=json_decode($originals['try/demo-asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);$new=json_decode($payloads['try/demo-asset-manifest.json'],true,32,JSON_THROW_ON_ERROR);
    $projection=$new;foreach(['index.html','workbook.js'] as $name)$projection['files'][$name]=$old['files'][$name];unset($projection['files']['demo-experience.css']);$projection['shell']=array_values(array_filter($projection['shell'],fn($name)=>$name!=='demo-experience.css'));
    if($projection!==$old||count($new['files'])!==count($old['files'])+1||count(array_filter($new['shell'],fn($name)=>$name==='demo-experience.css'))!==1
        ||hznDemoExperienceWorker($originals['try/sw.js']['bytes'])!==$payloads['try/sw.js']
        ||hznDemoExperiencePaidWorker($originals['learn/sw.js']['bytes'])!==$payloads['learn/sw.js'])throw new RuntimeException('DEMO_CURRICULUM_CHANGED');
    foreach(['index.html','workbook.js','demo-experience.css'] as $name)if(($new['files'][$name]['sha256']??'')!==$manifest['files']['try/'.$name]['sha256']||($new['files'][$name]['bytes']??0)!==$manifest['files']['try/'.$name]['bytes'])throw new RuntimeException('DEMO_MANIFEST_INVALID');
    if(($argv[2]??'')!=='--publish'){echo "READY: seven public demo UI files; 32 languages; 497 curriculum/media preserved.\n";exit;}
    $private=hznCreatorPublicPath(dirname($web),'.horizons-demo-experience');if(file_exists($private))throw new RuntimeException('DEMO_PRIVATE_STATE_CONFLICT');
    if(!mkdir($private,0700))throw new RuntimeException('DEMO_PRIVATE_STATE_FAILED');$privateCreated=true;if(!chmod($private,0700))throw new RuntimeException('DEMO_PRIVATE_STATE_FAILED');
    $lock=hznCreatorPublicPath($private,'deploy.lock');if(!mkdir($lock,0700))throw new RuntimeException('DEMO_DEPLOYMENT_BUSY');$locked=true;
    foreach(HZN_DEMO_BASELINE_HASHES as $relative=>$sha){if($sha===null)continue;$backup=hznCreatorPublicPath($private,'baseline/'.$relative);if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('DEMO_BACKUP_FAILED');hznDemoExperienceWrite($backup,$originals[$relative]['bytes'],0600);if(!hash_equals($sha,hash_file('sha256',$backup)))throw new RuntimeException('DEMO_BACKUP_FAILED');}
    foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative){
        $target=hznCreatorPublicPath($web,$relative);$before=$originals[$relative]['bytes'];
        if(($before===null&&file_exists($target))||($before!==null&&(!is_file($target)||hznCreatorPublicRead($target)!==$before)))throw new RuntimeException('DEMO_TARGET_CHANGED');
        hznDemoExperienceWrite($target,$payloads[$relative],0644);$written[]=$relative;
    }
    $hashes=[];$before=[];foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative){$hashes[$relative]=$manifest['files'][$relative]['sha256'];$before[$relative]=$manifest['files'][$relative]['before'];}
    hznDemoExperienceWrite(hznCreatorPublicPath($private,'receipt.json'),hznCreatorPublicJson(['schema'=>1,'patch'=>HZN_DEMO_EXPERIENCE_RELEASE,'creator_receipt_sha256'=>$creatorReceiptSha,'manifest_sha256'=>hash('sha256',$manifestRaw),'hashes'=>$hashes,'before_hashes'=>$before])."\n",0600);
    hznCreatorPublicState($web);echo "PUBLISHED: demo experience; 32 languages; 497 curriculum/media and paid workbook preserved.\n";
}catch(Throwable $error){
    foreach(array_reverse($written) as $relative){try{$target=hznCreatorPublicPath($web,$relative);if($originals[$relative]['bytes']===null){if(!unlink($target))throw new RuntimeException('DEMO_ROLLBACK_FAILED');}else hznDemoExperienceWrite($target,$originals[$relative]['bytes'],$originals[$relative]['mode']);}catch(Throwable $ignored){$restoreFailed=true;}}
    if($privateCreated&&!$restoreFailed&&is_file($private.'/receipt.json'))unlink($private.'/receipt.json');
    $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'DEMO_PUBLISH_FAILED';fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published changes rolled back')."\n");$failed=true;
}finally{
    if($locked&&is_dir($lock))rmdir($lock);
    if($failed&&$privateCreated&&!$restoreFailed){foreach(HZN_DEMO_BASELINE_HASHES as $relative=>$sha){if($sha===null)continue;$backup=hznCreatorPublicPath($private,'baseline/'.$relative);if(is_file($backup))unlink($backup);}foreach(['baseline/try','baseline/learn','baseline'] as $relative){$dir=hznCreatorPublicPath($private,$relative);if(is_dir($dir))rmdir($dir);}if(is_dir($private))rmdir($private);}
}
exit($failed?1:0);
