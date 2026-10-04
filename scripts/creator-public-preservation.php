<?php
declare(strict_types=1);
// Creator UI only. This receipt cannot authorize changes to curriculum, activation or learners.
const HZN_CREATOR_PUBLIC_RELEASE = 'creator-credit-20261004-r1';
const HZN_CREATOR_PUBLIC_PATHS = ['try/index.html','try/workbook.js','try/sw.js','learn/index.html','try/demo-asset-manifest.json'];
function hznCreatorPublicPath(string $root,string $relative):string {
    if (!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative)) throw new RuntimeException('CREATOR_PATH_INVALID');
    $current=rtrim($root,'/');
    foreach(explode('/',$relative) as $part){if($part==='.'||$part==='..')throw new RuntimeException('CREATOR_PATH_INVALID');$current.='/'.$part;if(is_link($current))throw new RuntimeException('CREATOR_SYMLINK_REJECTED');}
    return $current;
}
function hznCreatorPublicRead(string $path):string {
    if(is_link($path)||!is_file($path)||filesize($path)>2097152)throw new RuntimeException('CREATOR_FILE_INVALID');
    $raw=file_get_contents($path);if($raw===false)throw new RuntimeException('CREATOR_READ_FAILED');return $raw;
}
function hznCreatorPublicJson(array $value):string{return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function hznCreatorPublicState(string $web):?array {
    $private=hznCreatorPublicPath(dirname($web),'.horizons-creator-public');$path=hznCreatorPublicPath($private,'receipt.json');
    if(!is_file($path))return null;
    if(realpath($path)!==$path||str_starts_with($path,rtrim($web,'/').'/'))throw new RuntimeException('CREATOR_PRIVATE_RECEIPT_REQUIRED');
    $receiptRaw=hznCreatorPublicRead($path);$receipt=json_decode($receiptRaw,true,16,JSON_THROW_ON_ERROR);
    if(($receipt['schema']??null)!==1||($receipt['patch']??'')!==HZN_CREATOR_PUBLIC_RELEASE||array_keys($receipt['hashes']??[])!==HZN_CREATOR_PUBLIC_PATHS
        ||array_keys($receipt['before_hashes']??[])!==HZN_CREATOR_PUBLIC_PATHS||!preg_match('/^[a-f0-9]{64}$/D',$receipt['manifest_sha256']??''))throw new RuntimeException('CREATOR_RECEIPT_INVALID');
    require_once __DIR__.'/demo-experience-preservation.php';
    $demo=hznDemoExperienceState($web,$receipt,hash('sha256',$receiptRaw));
    $currentRoot=$demo===null?$web:hznCreatorPublicPath(dirname($web),'.horizons-demo-experience/baseline');
    foreach(HZN_CREATOR_PUBLIC_PATHS as $relative){
        $current=hznCreatorPublicPath($currentRoot,$relative);$backup=hznCreatorPublicPath($private,'baseline/'.$relative);
        $sha=$receipt['hashes'][$relative];$before=$receipt['before_hashes'][$relative];
        if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!preg_match('/^[a-f0-9]{64}$/D',$before)||!is_file($current)||!is_file($backup)
            ||!hash_equals($sha,hash_file('sha256',$current))||!hash_equals($before,hash_file('sha256',$backup)))throw new RuntimeException('CREATOR_PUBLIC_CHANGED');
    }
    $baseline=json_decode(hznCreatorPublicRead(hznCreatorPublicPath($private,'baseline/try/demo-asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    $creatorManifest=json_decode(hznCreatorPublicRead(hznCreatorPublicPath($currentRoot,'try/demo-asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    $projection=$creatorManifest;foreach(['index.html','workbook.js']as$name)$projection['files'][$name]=$baseline['files'][$name];
    if($projection!==$baseline)throw new RuntimeException('CREATOR_DEMO_CONTENT_CHANGED');
    $count=0;foreach($baseline['files'] as $name=>$entry)if(str_starts_with($name,'course/')||$name==='workbook-data.js')$count++;
    if($count!==497)throw new RuntimeException('CREATOR_DEMO_SCOPE_CHANGED');
    if($demo!==null){foreach(HZN_CREATOR_PUBLIC_PATHS as $relative)$receipt['hashes'][$relative]=$demo['hashes'][$relative];$receipt['demo_experience']=$demo;}
    return $receipt;
}
