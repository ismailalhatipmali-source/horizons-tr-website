<?php
declare(strict_types=1);
// One approved pronunciation correction; encrypt using the existing private vault.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
umask(0077);
function checkedPath(string $root, string $path): string {
    $current=$root;
    foreach(explode('/',$path) as $part) {
        if($part===''||$part==='.'||$part==='..') throw new RuntimeException('INVALID_PATH');
        $current.='/'.$part;
        if(is_link($current)) throw new RuntimeException('SYMLINK_REJECTED');
    }
    return $current;
}
function atomicWrite(string $path,string $bytes,int $mode=0644): void {
    $temp=$path.'.thaa-'.bin2hex(random_bytes(6));
    try {
        if(file_put_contents($temp,$bytes)!==strlen($bytes)||!chmod($temp,$mode)||!rename($temp,$path)) throw new RuntimeException('WRITE_FAILED');
    } finally { if(is_file($temp)) unlink($temp); }
}
$lock=null;$originals=[];$changed=[];
try {
    $input=$argv[1]??'';
    if(is_link($input)||!($web=realpath($input))||!is_dir($web)) throw new RuntimeException('INVALID_ROOT');
    $home=dirname($web);$learn=checkedPath($web,'learn');
    $state=checkedPath($home,'.horizons-thaa-audio');
    if(!is_dir($state)&&!mkdir($state,0700)) throw new RuntimeException('STATE_FAILED');
    $lock=fopen($state.'/deploy.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)) throw new RuntimeException('DEPLOYMENT_BUSY');
    $configPath=require checkedPath($web,'activation/config-path.php');
    if(!is_string($configPath)||is_link($configPath)||!($real=realpath($configPath))||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/')) throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
    $config=require $real;$vaultPath=$config['vault_path']??'';
    if(!is_string($vaultPath)||is_link($vaultPath)||!($real=realpath($vaultPath))||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/')) throw new RuntimeException('PRIVATE_VAULT_REQUIRED');
    $vault=json_decode(file_get_contents($real),true,8,JSON_THROW_ON_ERROR);
    $key=base64_decode($vault['content_key']??'',true);
    $product='horizons-arabic-level1';
    if(($vault['product']??'')!==$product||!is_string($key)||strlen($key)!==32) throw new RuntimeException('INVALID_VAULT');
    $plain=file_get_contents(dirname(__DIR__).'/release-assets/audio-thaa-20261003/alphabet.thaa.mp3');
    if(hash('sha256',$plain)!=='77aaaf8101f7db0c28e180ac3cc0966211c18d8438826bff339975f43c24adaa') throw new RuntimeException('SOURCE_CHECKSUM_FAILED');
    $path='course/audio/female-final/alphabet.thaa.mp3';
    $manifestPath=checkedPath($learn,'asset-manifest.json');
    $manifest=json_decode(file_get_contents($manifestPath),true,32,JSON_THROW_ON_ERROR);
    if(($manifest['product']??'')!==$product||($manifest['version']??'')!=='1.4.6'||!isset($manifest['files'][$path])) throw new RuntimeException('WORKBOOK_UPDATE_REQUIRED');
    $url='content/1.4.1/'.$path.'.hzn';$target=checkedPath($learn,$url);
    $cipher=is_file($target)?file_get_contents($target):'';$aad=$product.'/'.$path;
    $decoded=strlen($cipher)>28?openssl_decrypt(substr($cipher,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($cipher,0,12),substr($cipher,-16),$aad):false;
    if($decoded!==$plain) {
        $nonce=random_bytes(12);$tag='';
        $body=openssl_encrypt($plain,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$nonce,$tag,$aad,16);
        if($body===false) throw new RuntimeException('ENCRYPTION_FAILED');
        $cipher=$nonce.$body.$tag;
        if(openssl_decrypt($body,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$nonce,$tag,$aad)!==$plain) throw new RuntimeException('ENCRYPTION_CHECK_FAILED');
    }
    $manifest['files'][$path]=['url'=>$url,'sha256'=>hash('sha256',$cipher),'bytes'=>strlen($cipher),'mime'=>'audio/mpeg'];
    $swPath=checkedPath($learn,'sw.js');$sw=file_get_contents($swPath);
    $old="const SHELL = 'hzn-web-shell-' + VERSION;";
    $new="const SHELL = 'hzn-web-shell-' + VERSION + '-thaa-20261003';";
    if(!str_contains($sw,$old)&&!str_contains($sw,$new)) throw new RuntimeException('UNKNOWN_WORKER');
    $sw=str_replace($old,$new,$sw);
    $writes=[$target=>$cipher,$manifestPath=>json_encode($manifest,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n",$swPath=>$sw];
    $backup=$state.'/backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
    foreach($writes as $dest=>$bytes) {
        $current=is_file($dest)?file_get_contents($dest):null;
        if($current===$bytes) continue;
        $originals[$dest]=$current;
    }
    if($originals) {
        mkdir($backup,0700);
        foreach($originals as $dest=>$bytes) if($bytes!==null) file_put_contents($backup.'/'.hash('sha256',$dest),$bytes);
        file_put_contents($backup.'/paths.json',json_encode(array_keys($originals),JSON_THROW_ON_ERROR));
    }
    foreach($writes as $dest=>$bytes) {
        if(!array_key_exists($dest,$originals)) continue;
        if(!is_dir(dirname($dest))&&!mkdir(dirname($dest),0755,true)) throw new RuntimeException('DIRECTORY_FAILED');
        atomicWrite($dest,$bytes);$changed[]=$dest;
    }
    echo "OK: THAA_AUDIO_PATCH; ".count($changed)." files updated; encrypted audio verified.\n";
} catch(Throwable $e) {
    foreach(array_reverse($changed) as $dest) { if($originals[$dest]===null) @unlink($dest);else atomicWrite($dest,$originals[$dest]); }
    fwrite(STDERR,"THAA_PATCH_FAILED: ".$e->getMessage()."\n");exit(1);
} finally {if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}}
