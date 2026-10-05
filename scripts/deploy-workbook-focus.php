<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/workbook-focus-preservation.php';
require_once __DIR__.'/blending4-preservation.php';
require_once __DIR__.'/comprehensive-meaning-preservation.php';
require_once __DIR__.'/blending3-preservation.php';
require_once __DIR__.'/blending2-preservation.php';
function hznFocusWrite(string $path,string $raw,int $mode):void {
    $tmp=$path.'.focus-'.bin2hex(random_bytes(6));try{if(file_put_contents($tmp,$raw)!==strlen($raw)||!chmod($tmp,$mode)||!rename($tmp,$path))throw new RuntimeException('FOCUS_WRITE_FAILED');}finally{if(is_file($tmp))unlink($tmp);}
}
function hznFocusPlain(string $raw,string $key):string {
    $packed=strlen($raw)>28?openssl_decrypt(substr($raw,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,-16),'horizons-arabic-level1/workbook.js'):false;
    if($packed===false||($plain=gzdecode($packed,33554432))===false)throw new RuntimeException('FOCUS_DECRYPT_FAILED');return $plain;
}
function hznFocusCipher(string $plain,string $key):string {
    $iv=random_bytes(12);$tag='';$packed=gzencode($plain,9);if($packed===false)throw new RuntimeException('FOCUS_COMPRESS_FAILED');$cipher=openssl_encrypt($packed,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,'horizons-arabic-level1/workbook.js',16);if($cipher===false)throw new RuntimeException('FOCUS_ENCRYPT_FAILED');$result=$iv.$cipher.$tag;if(hznFocusPlain($result,$key)!==$plain)throw new RuntimeException('FOCUS_ENCRYPT_CHECK_FAILED');return $result;
}
function hznFocusChain(string $web):array {
    $b4=hznB4State($web);$cm=hznCMState($web);if(!$b4||!$cm||!hznB3State($web)||!hznBlending2SupersedingState($web))throw new RuntimeException('FOCUS_APPROVED_BASELINE_REQUIRED');return [$b4,$cm];
}
// All write/rollback behavior is kept in one transaction. Tests inject a throwing
// checkpoint into this function on synthetic temporary roots; CLI has no such flag.
function hznFocusPublish(string $web,array $payload,array $originals,array $receipt,callable $verify,?callable $checkpoint=null):void {
    $home=dirname($web);$private=hznFocusPath($home,'.horizons-workbook-focus');$lockPath=hznFocusPath($home,'.horizons-workbook-focus.lock');$lock=null;$written=[];$created=false;$restoreFailed=false;
    try{
        $lock=fopen($lockPath,'c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('FOCUS_DEPLOY_BUSY');if(!chmod($lockPath,0600))throw new RuntimeException('FOCUS_LOCK_FAILED');
        if(file_exists($private)||!mkdir($private,0700))throw new RuntimeException('FOCUS_PRIVATE_STATE_CONFLICT');$created=true;
        foreach(HZN_FOCUS_PATHS as $p){$target=hznFocusPath($web,$p);if(hznFocusRead($target)!==$originals[$p]['bytes']||(fileperms($target)&0777)!==$originals[$p]['mode'])throw new RuntimeException('FOCUS_CONCURRENT_CHANGE');$backup=hznFocusPath($private,'baseline/'.$p);if(!is_dir(dirname($backup))&&!mkdir(dirname($backup),0700,true))throw new RuntimeException('FOCUS_BACKUP_FAILED');hznFocusWrite($backup,$originals[$p]['bytes'],0600);}
        foreach($receipt['inherited_receipts'] as $p=>$sha)if(!hash_equals($sha,hash('sha256',hznFocusRead(hznFocusPath($home,$p)))))throw new RuntimeException('FOCUS_CONCURRENT_RECEIPT_CHANGE');
        // Both applications first, then both manifests, then workers. No educational media writes.
        $order=['try/workbook.js','learn/content/1.4.1/workbook.js.hzn','try/demo-asset-manifest.json','learn/asset-manifest.json','try/sw.js','learn/sw.js'];
        foreach($order as $p){$target=hznFocusPath($web,$p);if(hznFocusRead($target)!==$originals[$p]['bytes']||(fileperms($target)&0777)!==$originals[$p]['mode'])throw new RuntimeException('FOCUS_CONCURRENT_CHANGE');hznFocusWrite($target,$payload[$p],0644);$written[]=$p;if($checkpoint!==null)$checkpoint(count($written));}
        hznFocusWrite(hznFocusPath($private,'receipt.json'),hznFocusJson($receipt)."\n",0600);$verify();
    }catch(Throwable $error){
        foreach(array_reverse($written) as $p){try{
            $target=hznFocusPath($web,$p);
            // A rollback owns only the exact bytes/mode it wrote. Preserve any
            // later external edit and retain recovery evidence for review.
            if(hznFocusRead($target)!==$payload[$p]||(fileperms($target)&0777)!==0644)throw new RuntimeException('FOCUS_ROLLBACK_CONCURRENT_CHANGE');
            hznFocusWrite($target,$originals[$p]['bytes'],$originals[$p]['mode']);
        }catch(Throwable $ignored){$restoreFailed=true;}}
        if($created&&!$restoreFailed){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($private,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){if($f->isLink())throw new RuntimeException('FOCUS_RESTORE_REQUIRES_ATTENTION');if($f->isDir()){if(!rmdir($f->getPathname()))$restoreFailed=true;}elseif(!unlink($f->getPathname()))$restoreFailed=true;}if(!$restoreFailed&&!rmdir($private))$restoreFailed=true;}
        if($restoreFailed)throw new RuntimeException('FOCUS_RESTORE_REQUIRES_ATTENTION');throw $error;
    }finally{if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}}
}
// Library mode is used only by the isolated transaction tests, never by CLI.
if(defined('HZN_FOCUS_DEPLOY_LIBRARY_ONLY'))return;
try{
    if(count($argv)<2||count($argv)>3||(isset($argv[2])&&$argv[2]!=='--publish'))throw new RuntimeException('FOCUS_ARGUMENTS_INVALID');
    $input=rtrim($argv[1],'/');$web=realpath($input);$repo=realpath(dirname(__DIR__));if(!$web||$web!==$input||$web==='/'||is_link($input)||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('FOCUS_ROOT_INVALID');
    $release=hznFocusRelease($repo);$current=hznFocusState($web);[$b4,$cm]=hznFocusChain($web);if($current!==null){echo "CURRENT: focus UI and complete predecessor chain verified; no files changed.\n";exit;}
    $originals=[];$before=[];$modes=[];foreach(HZN_FOCUS_PATHS as $p){$path=hznFocusPath($web,$p);$raw=hznFocusRead($path);$sha=str_starts_with($p,'try/')?$cm['hashes'][$p]:$b4['hashes'][$p];if(!hash_equals($sha,hash('sha256',$raw))||(fileperms($path)&0777)!==0644)throw new RuntimeException('FOCUS_BASELINE_CHANGED');$originals[$p]=['bytes'=>$raw,'mode'=>0644];$before[$p]=$sha;$modes[$p]=0644;}
    $payload=[];foreach(HZN_FOCUS_PUBLIC as $p){$entry=$release['files'][$p];if($entry['before']!==$before[$p])throw new RuntimeException('FOCUS_DEMO_BASELINE_CHANGED');$payload[$p]=hznFocusRead(hznFocusPath($repo,$entry['source']));}
    if(hznFocusPatch($originals['try/workbook.js']['bytes'],$repo,$release,false)!==$payload['try/workbook.js']||hznFocusWorker($originals['try/sw.js']['bytes'],false)!==$payload['try/sw.js'])throw new RuntimeException('FOCUS_DEMO_PATCH_CHANGED');
    $oldDemo=json_decode($originals['try/demo-asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);$newDemo=json_decode($payload['try/demo-asset-manifest.json'],true,32,JSON_THROW_ON_ERROR);hznFocusProjection($oldDemo,$newDemo,false);
    if(($newDemo['files']['workbook.js']['sha256']??'')!==hash('sha256',$payload['try/workbook.js'])||($newDemo['files']['workbook.js']['bytes']??0)!==strlen($payload['try/workbook.js']))throw new RuntimeException('FOCUS_DEMO_MANIFEST_INVALID');
    $home=dirname($web);$pointer=require hznFocusPath($web,'activation/config-path.php');if(!is_string($pointer)||is_link($pointer)||!($cp=realpath($pointer))||!str_starts_with($cp,$home.'/')||str_starts_with($cp,$web.'/'))throw new RuntimeException('FOCUS_PRIVATE_CONFIG_REQUIRED');ob_start();try{$config=require $cp;}finally{ob_end_clean();}
    $vp=$config['vault_path']??'';if(!is_string($vp)||is_link($vp)||!($vr=realpath($vp))||!str_starts_with($vr,$home.'/')||str_starts_with($vr,$web.'/'))throw new RuntimeException('FOCUS_PRIVATE_VAULT_REQUIRED');$vault=json_decode(hznFocusRead($vr,65536),true,8,JSON_THROW_ON_ERROR);$key=base64_decode($vault['content_key']??'',true);if(($vault['product']??'')!=='horizons-arabic-level1'||!is_string($key)||strlen($key)!==32)throw new RuntimeException('FOCUS_VAULT_INVALID');
    $manifest=json_decode($originals['learn/asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR);$plain=hznFocusPlain($originals['learn/content/1.4.1/workbook.js.hzn']['bytes'],$key);
    if(strlen($plain)!==$manifest['files']['workbook.js']['decoded_bytes']||!hash_equals($b4['plain_after_sha256'],hash('sha256',$plain))||($manifest['blending4_languages']??[])!==$release['languages'])throw new RuntimeException('FOCUS_PLAIN_BASELINE_CHANGED');
    $updated=hznFocusPatch($plain,$repo,$release,true);$plainBefore=hash('sha256',$plain);$plainAfter=hash('sha256',$updated);$app=hznFocusCipher($updated,$key);$payload['learn/content/1.4.1/workbook.js.hzn']=$app;$manifest['files']['workbook.js']['sha256']=hash('sha256',$app);$manifest['files']['workbook.js']['bytes']=strlen($app);$manifest['files']['workbook.js']['decoded_bytes']=strlen($updated);
    hznFocusProjection(json_decode($originals['learn/asset-manifest.json']['bytes'],true,32,JSON_THROW_ON_ERROR),$manifest,true);$payload['learn/asset-manifest.json']=hznFocusJson($manifest)."\n";$payload['learn/sw.js']=hznFocusWorker($originals['learn/sw.js']['bytes'],true);unset($key,$config,$vault,$plain,$updated);
    $hashes=[];foreach(HZN_FOCUS_PATHS as $p)$hashes[$p]=hash('sha256',$payload[$p]);$inherited=[];foreach(['.horizons-blending4/receipt.json','.horizons-comprehensive-meaning/receipt.json'] as $p)$inherited[$p]=hash('sha256',hznFocusRead(hznFocusPath($home,$p),262144));
    $receipt=['schema'=>1,'release'=>HZN_FOCUS_RELEASE,'manifest_sha256'=>$release['manifest_sha256'],'sources'=>$release['sources'],'hashes'=>$hashes,'before_hashes'=>$before,'before_modes'=>$modes,'inherited_receipts'=>$inherited,'plain_before_sha256'=>$plainBefore,'plain_after_sha256'=>$plainAfter];
    if(($argv[2]??'')!=='--publish'){echo "READY: six UI targets verified, reversible player transformation, content manifests preserved; no files written.\n";exit;}
    hznFocusPublish($web,$payload,$originals,$receipt,function()use($web){hznFocusState($web);hznFocusChain($web);});
    echo "PUBLISHED: focus UI; educational assets and prior receipts preserved. Verify browsers and licensed audio before declaring completion.\n";
}catch(Throwable $error){$code=$error instanceof RuntimeException&&preg_match('/^[A-Z0-9_]+$/D',$error->getMessage())?$error->getMessage():'FOCUS_DEPLOY_FAILED';fwrite(STDERR,'STOP: '.$code."\n");exit(1);}
