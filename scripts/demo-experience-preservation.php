<?php
declare(strict_types=1);
// A public UI successor; its immutable predecessor is the approved creator overlay.
const HZN_DEMO_EXPERIENCE_RELEASE = 'demo-experience-20261004-r1';
const HZN_DEMO_CREATOR_MANIFEST_SHA256 = '3011a7fe79e88e6c596c9a55caf5592281de7d4f5ebd6ecf2a76eaaadc781032';
const HZN_DEMO_EXPERIENCE_PATHS = ['try/index.html','try/workbook.js','try/sw.js','learn/index.html','try/demo-asset-manifest.json','try/demo-experience.css','learn/sw.js'];
const HZN_DEMO_CREATOR_HASHES = [
    'try/index.html'=>'5877c9bca0ecdff0a5fc394aebc9edd9e7d220beb9d79a0c90ea9eaa4d3740b0',
    'try/workbook.js'=>'0574fe4429f0858ea63a0dc7127d957997045c827e890b1abf2fd1722ca52c8a',
    'try/sw.js'=>'eb26d7daa8d783f143001b88b1a4af8bcf8736a51e37f492636795e066aedb7d',
    'learn/index.html'=>'5b60b2f560615419df2a9bef483e69b94975e84e877680dec5ac0b3bab7ae9df',
    'try/demo-asset-manifest.json'=>'121713f1e49d276b714ab682feb29364f7b92c6c4d1cbac81e40037a821715c0',
];
const HZN_DEMO_BASELINE_HASHES = [...HZN_DEMO_CREATOR_HASHES,'try/demo-experience.css'=>null,'learn/sw.js'=>'b1fb25fd68b21fdd6f0dfc892297b31bd2205b490f1fa7f145ee3d38758cae71'];
function hznDemoExperiencePaidWorker(string $before): string {
    $old="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3';";
    $new="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';";
    if(substr_count($before,$old)!==1)throw new RuntimeException('DEMO_PAID_WORKER_BASELINE_CHANGED');return str_replace($old,$new,$before);
}
function hznDemoExperienceWorker(string $before): string {
    $old="const CACHE='hzn-public-demo-'+VERSION+'-creator-credit-20261004-r1';";
    $new="const CACHE='hzn-public-demo-'+VERSION+'-demo-experience-20261004-r1';";
    $pattern='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-creator-credit-\\d{8}-r\\d+)?$/';
    $replacement='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience)-\\d{8}-r\\d+)?$/';
    if(substr_count($before,$old)!==1||substr_count($before,$pattern)!==1)throw new RuntimeException('DEMO_WORKER_BASELINE_CHANGED');
    return str_replace([$old,$pattern],[$new,$replacement],$before);
}
function hznDemoExperienceState(string $web,array $creator,string $creatorReceiptSha): ?array {
    $private=hznCreatorPublicPath(dirname($web),'.horizons-demo-experience');$path=hznCreatorPublicPath($private,'receipt.json');
    if(!is_file($path))return null;
    if(realpath($path)!==$path||str_starts_with($path,rtrim($web,'/').'/')||(fileperms($private)&0777)!==0700)throw new RuntimeException('DEMO_PRIVATE_RECEIPT_REQUIRED');
    $receipt=json_decode(hznCreatorPublicRead($path),true,16,JSON_THROW_ON_ERROR);
    require_once __DIR__.'/comprehensive-meaning-preservation.php';
    $successor=hznCMState($web);$currentRoot=$successor===null?$web:$successor['baseline_root'];
    if(($receipt['schema']??null)!==1||($receipt['patch']??'')!==HZN_DEMO_EXPERIENCE_RELEASE
        ||($receipt['creator_receipt_sha256']??'')!==$creatorReceiptSha||($creator['hashes']??[])!==HZN_DEMO_CREATOR_HASHES
        ||($creator['manifest_sha256']??'')!==HZN_DEMO_CREATOR_MANIFEST_SHA256
        ||array_keys($receipt['hashes']??[])!==HZN_DEMO_EXPERIENCE_PATHS||array_keys($receipt['before_hashes']??[])!==HZN_DEMO_EXPERIENCE_PATHS
        ||!preg_match('/^[a-f0-9]{64}$/D',$receipt['manifest_sha256']??''))throw new RuntimeException('DEMO_RECEIPT_INVALID');
    foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative){
        $file=hznCreatorPublicPath($currentRoot,$relative);$sha=$receipt['hashes'][$relative];
        if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!is_file($file)||!hash_equals($sha,hash_file('sha256',$file)))throw new RuntimeException('DEMO_PUBLIC_CHANGED');
        $before=hznCreatorPublicPath($private,'baseline/'.$relative);
        if($relative==='try/demo-experience.css'){
            if($receipt['before_hashes'][$relative]!==null||file_exists($before))throw new RuntimeException('DEMO_BASELINE_CHANGED');
        }elseif(($receipt['before_hashes'][$relative]??'')!==HZN_DEMO_BASELINE_HASHES[$relative]
            ||!is_file($before)||!hash_equals(HZN_DEMO_BASELINE_HASHES[$relative],hash_file('sha256',$before)))throw new RuntimeException('DEMO_BASELINE_CHANGED');
    }
    $baseline=json_decode(hznCreatorPublicRead(hznCreatorPublicPath($private,'baseline/try/demo-asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    $manifest=json_decode(hznCreatorPublicRead(hznCreatorPublicPath($currentRoot,'try/demo-asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    $projected=$manifest;foreach(['index.html','workbook.js'] as $name)$projected['files'][$name]=$baseline['files'][$name];
    unset($projected['files']['demo-experience.css']);$projected['shell']=array_values(array_filter($projected['shell'],fn($name)=>$name!=='demo-experience.css'));
    if($projected!==$baseline||count($manifest['files'])!==count($baseline['files'])+1
        ||count(array_filter($manifest['shell'],fn($name)=>$name==='demo-experience.css'))!==1)throw new RuntimeException('DEMO_CURRICULUM_CHANGED');
    foreach(['index.html','workbook.js','demo-experience.css'] as $name){
        $entry=$manifest['files'][$name]??[];$file=hznCreatorPublicPath($currentRoot,'try/'.$name);
        if(($entry['sha256']??'')!==$receipt['hashes']['try/'.$name]||($entry['bytes']??-1)!==filesize($file))throw new RuntimeException('DEMO_MANIFEST_INVALID');
    }
    if(hznDemoExperienceWorker(hznCreatorPublicRead(hznCreatorPublicPath($private,'baseline/try/sw.js')))!==hznCreatorPublicRead(hznCreatorPublicPath($currentRoot,'try/sw.js')))throw new RuntimeException('DEMO_WORKER_CHANGED');
    if(hznDemoExperiencePaidWorker(hznCreatorPublicRead(hznCreatorPublicPath($private,'baseline/learn/sw.js')))!==hznCreatorPublicRead(hznCreatorPublicPath($currentRoot,'learn/sw.js')))throw new RuntimeException('DEMO_PAID_WORKER_CHANGED');
    if($successor!==null){foreach(HZN_DEMO_EXPERIENCE_PATHS as $relative)$receipt['hashes'][$relative]=$successor['hashes'][$relative];$receipt['comprehensive_meaning']=$successor;}
    return $receipt;
}
