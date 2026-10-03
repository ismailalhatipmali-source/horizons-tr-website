<?php
declare(strict_types=1);
// Extend the existing encrypted application using its server-owned key.
// No key or decrypted original application is written to the public tree.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
umask(0077);
function pp(string $root,string $relative):string {
    $p=$root;
    foreach(explode('/',$relative) as $part){
        if($part===''||$part==='.'||$part==='..'||preg_match('/[\\\\\x00-\x1f?#]/',$part))throw new RuntimeException('INVALID_PATH');
        $p.='/'.$part;if(is_link($p))throw new RuntimeException('SYMLINK_REJECTED');
    }
    return $p;
}
function pa(string $p,string $bytes,int $mode=0644):void {
    $t=$p.'.phonics-'.bin2hex(random_bytes(6));
    try{if(file_put_contents($t,$bytes)!==strlen($bytes)||!chmod($t,$mode)||!rename($t,$p))throw new RuntimeException('WRITE_FAILED');}
    finally{if(is_file($t))unlink($t);}
}
function pdecode(string $bytes,string $key,string $aad):string {
    $plain=strlen($bytes)>28?openssl_decrypt(substr($bytes,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($bytes,0,12),substr($bytes,-16),$aad):false;
    if($plain===false)throw new RuntimeException('DECRYPTION_FAILED');return $plain;
}
function pjson(array $v):string{return json_encode($v,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";}
$lock=null;$originals=[];$changed=[];
try{
    $input=$argv[1]??'';
    if(is_link($input)||!($web=realpath($input))||!is_dir($web))throw new RuntimeException('INVALID_ROOT');
    $home=dirname($web);$learn=pp($web,'learn');$private=pp($home,'.horizons-phonics');
    if(!is_dir($private)&&!mkdir($private,0700))throw new RuntimeException('PRIVATE_STATE_FAILED');
    $lock=fopen(pp($private,'deploy.lock'),'c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('DEPLOYMENT_BUSY');
    $configPath=require pp($web,'activation/config-path.php');
    if(!is_string($configPath)||is_link($configPath)||!($real=realpath($configPath))||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/'))throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
    $config=require $real;$vaultPath=$config['vault_path']??'';
    if(!is_string($vaultPath)||is_link($vaultPath)||!($real=realpath($vaultPath))||!str_starts_with($real,$home.'/')||str_starts_with($real,$web.'/'))throw new RuntimeException('PRIVATE_VAULT_REQUIRED');
    $vault=json_decode(file_get_contents($real),true,8,JSON_THROW_ON_ERROR);$key=base64_decode($vault['content_key']??'',true);$product='horizons-arabic-level1';
    if(($vault['product']??'')!==$product||!is_string($key)||strlen($key)!==32)throw new RuntimeException('INVALID_VAULT');
    $repo=dirname(__DIR__);$assets=pp($repo,'release-assets/phonics-20261003');
    $release=json_decode(file_get_contents(pp($assets,'release.json')),true,32,JSON_THROW_ON_ERROR);
    if(($release['patch']??'')!=='phonics-20261003'||count($release['audio']??[])!==168)throw new RuntimeException('SOURCE_INVALID');
    foreach($release['sources']??[] as $path=>$sha){if(!preg_match('/^[a-f0-9]{64}$/',$sha)||hash_file('sha256',pp($repo,$path))!==$sha)throw new RuntimeException('SOURCE_CHECKSUM_FAILED');}
    $manifestPath=pp($learn,'asset-manifest.json');$manifest=json_decode(file_get_contents($manifestPath),true,32,JSON_THROW_ON_ERROR);
    if(($manifest['version']??'')!=='1.4.6'||($manifest['product']??'')!==$product||($manifest['content_versions']??[])!==['1.4.0','1.4.1'])throw new RuntimeException('WORKBOOK_UPDATE_REQUIRED');
    $receiptPath=pp($private,'receipt.json');$receipt=is_file($receiptPath)?json_decode(file_get_contents($receiptPath),true,32,JSON_THROW_ON_ERROR):null;
    $workPath='workbook.js';$entry=$manifest['files'][$workPath]??null;
    if(!$entry||!in_array($entry['url'],['content/1.4.0/workbook.js.hzn','content/1.4.1/workbook.js.hzn'],true))throw new RuntimeException('UNKNOWN_APPLICATION');
    $raw=file_get_contents(pp($learn,$entry['url']));if(hash('sha256',$raw)!==$entry['sha256'])throw new RuntimeException('APPLICATION_DAMAGED');
    // Pin the original ciphertext to the previous released manifest. On retries
    // accept only the exact application recorded by our last completed publish.
    $baseline=json_decode(file_get_contents(pp($repo,'release-assets/1.4.6/files/learn/asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    if($entry['sha256']!==$baseline['files'][$workPath]['sha256']&&($receipt['hashes'][$entry['url']]??'')!==hash('sha256',$raw))throw new RuntimeException('APPLICATION_BASELINE_CHANGED');
    $original=pdecode($raw,$key,$product.'/'.$workPath);
    if(($entry['encoding']??null)==='gzip'){$original=gzdecode($original,32*1024*1024);if($original===false||strlen($original)!==($entry['decoded_bytes']??-1))throw new RuntimeException('APPLICATION_ENCODING_INVALID');}
    elseif(isset($entry['encoding']))throw new RuntimeException('APPLICATION_ENCODING_INVALID');
    $begin="\n// HZN_PHONICS_20261003_BEGIN\n";$end="\n// HZN_PHONICS_20261003_END\n";
    if(str_contains($original,$begin)){
        $start=strpos($original,$begin);$finish=strpos($original,$end,$start);
        if($finish===false||substr_count($original,$begin)!==1||substr_count($original,$end)!==1)throw new RuntimeException('EXTENSION_INVALID');
        $original=substr($original,0,$start).substr($original,$finish+strlen($end));
    }
    $tail="\ninit();\n\n})();";
    if(substr_count($original,$tail)!==1)throw new RuntimeException('APPLICATION_HOOK_NOT_FOUND');
    $extension=file_get_contents(pp($repo,'src/phonics/phonics-extension.js'));
    if(substr_count($extension,'/*PHONICS_DATA*/')!==1)throw new RuntimeException('EXTENSION_DATA_INVALID');
    $css=file_get_contents(pp($repo,'src/phonics/phonics.css'));
    $rows=[];$payloads=[];$seen=[];
    foreach($release['audio'] as $item){
        $id=$item['id']??'';$path=$item['path']??'';
        if(!preg_match('/^phonics\.[a-z_]+\.(fatha|damma|kasra)\.(short|long)$/',$id)||$path!=='course/audio/phonics/'.$id.'.mp3'||isset($seen[$id]))throw new RuntimeException('AUDIO_MAPPING_INVALID');
        $seen[$id]=true;$plain=file_get_contents(pp($assets,'audio/'.$id.'.mp3'));
        if(hash('sha256',$plain)!==($item['sha256']??''))throw new RuntimeException('AUDIO_CHECKSUM_FAILED');
        $rows[]=['id'=>$id,'text'=>$item['text'],'path'=>$path,'letterKey'=>$item['letterKey'],'vowel'=>$item['vowel'],'length'=>$item['length'],'index'=>$item['index']];
        $payloads[$path]=[$plain,'audio/mpeg',false];
    }
    $extension=str_replace('/*PHONICS_DATA*/',json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),$extension);
    $style="const phonicsStyle=document.createElement('style');phonicsStyle.textContent=".json_encode($css,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR).";document.head.append(phonicsStyle);\n";
    $app=str_replace($tail,$begin.$style.$extension.$end.$tail,$original);
    $payloads[$workPath]=[$app,'text/javascript; charset=utf-8',true];
    $writes=[];$hashes=[];
    foreach($payloads as $path=>[$plain,$mime,$compress]){
        $packed=$compress?gzencode($plain,9):$plain;if($packed===false)throw new RuntimeException('COMPRESSION_FAILED');
        $url='content/1.4.1/'.$path.'.hzn';$dest=pp($learn,$url);$cipher=is_file($dest)?file_get_contents($dest):'';
        try{$same=pdecode($cipher,$key,$product.'/'.$path)===$packed;}catch(Throwable){$same=false;}
        if(!$same){$nonce=random_bytes(12);$tag='';$body=openssl_encrypt($packed,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$nonce,$tag,$product.'/'.$path,16);if($body===false)throw new RuntimeException('ENCRYPTION_FAILED');$cipher=$nonce.$body.$tag;}
        if(pdecode($cipher,$key,$product.'/'.$path)!==$packed)throw new RuntimeException('ENCRYPTION_CHECK_FAILED');
        $sha=hash('sha256',$cipher);$hashes[$url]=$sha;$writes[$dest]=$cipher;
        $manifest['files'][$path]=['url'=>$url,'sha256'=>$sha,'bytes'=>strlen($cipher),'mime'=>$mime];
        if($compress){$manifest['files'][$path]['encoding']='gzip';$manifest['files'][$path]['decoded_bytes']=strlen($plain);}
    }
    $paths=array_keys($payloads);
    foreach(['all'] as $group){if(!isset($manifest['groups'][$group]))throw new RuntimeException('MANIFEST_GROUP_REQUIRED');$manifest['groups'][$group]=array_values(array_unique(array_merge($manifest['groups'][$group],$paths)));sort($manifest['groups'][$group]);}
    $manifest['groups']['phonics']=$paths;sort($manifest['groups']['phonics']);
    $manifest['phonics_release']='phonics-20261003';
    $swPath=pp($learn,'sw.js');$sw=file_get_contents($swPath);
    $suffix="const SHELL = 'hzn-web-shell-' + VERSION + '-phonics-20261003';";
    $replace=["const SHELL = 'hzn-web-shell-' + VERSION;","const SHELL = 'hzn-web-shell-' + VERSION + '-thaa-20261003';",$suffix];
    $matches=0;foreach($replace as $marker)$matches+=substr_count($sw,$marker);
    if($matches!==1)throw new RuntimeException('UNKNOWN_WORKER');
    $sw=str_replace($replace,$suffix,$sw);
    $writes[$manifestPath]=pjson($manifest);$writes[$swPath]=$sw;
    $hashes['asset-manifest.json']=hash('sha256',$writes[$manifestPath]);$hashes['sw.js']=hash('sha256',$sw);
    $receipt=['schema'=>1,'patch'=>'phonics-20261003','hashes'=>$hashes,'plain_workbook_sha256'=>hash('sha256',$app),'audio_count'=>168];
    $writes[$receiptPath]=pjson($receipt);
    foreach($writes as $dest=>$bytes){$old=is_file($dest)?file_get_contents($dest):null;if($old!==$bytes)$originals[$dest]=$old;}
    if($originals){$backup=pp($private,'backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)));if(!mkdir($backup,0700))throw new RuntimeException('BACKUP_FAILED');
        foreach($originals as $dest=>$bytes)if($bytes!==null&&file_put_contents($backup.'/'.hash('sha256',$dest),$bytes)!==strlen($bytes))throw new RuntimeException('BACKUP_FAILED');
        if(file_put_contents($backup.'/paths.json',pjson(array_keys($originals)))===false)throw new RuntimeException('BACKUP_FAILED');
    }
    foreach($writes as $dest=>$bytes){
        $isPrivate=$dest===$receiptPath;
        if(!$isPrivate){$dir=$learn;foreach(explode('/',substr(dirname($dest),strlen($learn)+1)) as $part){if($part==='')continue;$dir.='/'.$part;if(!is_dir($dir)&&!mkdir($dir,0755))throw new RuntimeException('DIRECTORY_FAILED');if(!chmod($dir,0755))throw new RuntimeException('DIRECTORY_FAILED');}}
        if(!array_key_exists($dest,$originals))continue;pa($dest,$bytes,$isPrivate?0600:0644);$changed[]=$dest;
    }
    echo 'OK: PHONICS_SECTION; 168 audio assets; '.count($changed)." files updated; encrypted workbook verified.\n";
}catch(Throwable $e){
    foreach(array_reverse($changed) as $dest){if($originals[$dest]===null)@unlink($dest);else pa($dest,$originals[$dest],$dest===($receiptPath??'')?0600:0644);}
    fwrite(STDERR,'PHONICS_DEPLOY_FAILED: '.$e->getMessage()."\n");exit(1);
}finally{if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}}
