<?php
declare(strict_types=1);
// A verified successor to the already published institution, currency and marketing releases.
const HZN_PC_VERSION='pricing-cards-20261004-r1';
const HZN_PC_MANIFEST_SHA256='c753af1d67db8b7bbda40cc320aa3a2e204669c9ca849e9b67979a409571a233';
function hznPCPath(string $root,string $relative):string {
    if(!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative)
       ||str_contains('/'.$relative.'/','/../')||str_contains('/'.$relative.'/','/./'))throw new RuntimeException('PRICING_PATH_INVALID');
    $path=rtrim($root,'/');foreach(explode('/',$relative) as $part){$path.='/'.$part;if(is_link($path))throw new RuntimeException('PRICING_SYMLINK_REJECTED');}return $path;
}
function hznPCRead(string $path,int $max=2097152):string {
    if(is_link($path)||!is_file($path)||filesize($path)<1||filesize($path)>$max)throw new RuntimeException('PRICING_FILE_INVALID');
    $raw=file_get_contents($path);if($raw===false)throw new RuntimeException('PRICING_READ_FAILED');return $raw;
}
function hznPCManifest(string $repo):array {
    $path=hznPCPath($repo,'release-assets/'.HZN_PC_VERSION.'/manifest.json');$raw=hznPCRead($path,131072);
    if(!hash_equals(HZN_PC_MANIFEST_SHA256,hash('sha256',$raw)))throw new RuntimeException('PRICING_MANIFEST_CHANGED');
    $m=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if(($m['schema']??null)!==1||($m['version']??'')!==HZN_PC_VERSION
       ||count($m['languages']??[])!==32||count($m['files']??[])!==100
       ||!preg_match('/^[a-f0-9]{64}$/D',$m['marketing_manifest_sha256']??''))
       throw new RuntimeException('PRICING_MANIFEST_INVALID');
    $approved=['checkout.js','checkout.css','display-currency.js','display-currency.css'];
    foreach($m['languages'] as $lang){if(!preg_match('/^[a-z]{2}$/D',$lang))throw new RuntimeException('PRICING_LANG_INVALID');foreach(['product','checkout','cart'] as $page)$approved[]="$lang/$page.html";}
    if(array_keys($m['files'])!==$approved)throw new RuntimeException('PRICING_SCOPE_INVALID');
    foreach($m['files'] as $relative=>$entry){
        $source='release-assets/'.HZN_PC_VERSION.'/files/'.$relative;
        if(($entry['source']??'')!==$source||!preg_match('/^[a-f0-9]{64}$/D',$entry['sha256']??'')
           ||!preg_match('/^[a-f0-9]{64}$/D',$entry['before']??'')
           ||!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>524288)
           throw new RuntimeException('PRICING_ENTRY_INVALID');
        $raw=hznPCRead(hznPCPath($repo,$source),524288);
        if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hash('sha256',$raw)))throw new RuntimeException('PRICING_SOURCE_CHANGED');
    }
    $marketing=hznPCRead(hznPCPath($repo,'release-assets/demo-marketing-20261004-r1/manifest.json'),131072);
    if(!hash_equals($m['marketing_manifest_sha256'],hash('sha256',$marketing)))throw new RuntimeException('PRICING_MARKETING_SOURCE_CHANGED');
    return $m;
}
function hznPCState(string $web):?array {
    $home=dirname($web);$private=hznPCPath($home,'.horizons-pricing-cards');$receiptPath=hznPCPath($private,'receipt.json');
    if(!is_file($receiptPath))return null;
    if(realpath($private)!==$private||(fileperms($private)&0777)!==0700
       ||realpath($receiptPath)!==$receiptPath||(fileperms($receiptPath)&0777)!==0600)throw new RuntimeException('PRICING_PRIVATE_RECEIPT_INVALID');
    $m=hznPCManifest(dirname(__DIR__));$r=json_decode(hznPCRead($receiptPath,65536),true,16,JSON_THROW_ON_ERROR);
    if(($r['schema']??null)!==1||($r['version']??'')!==HZN_PC_VERSION
       ||($r['manifest_sha256']??'')!==HZN_PC_MANIFEST_SHA256
       ||array_keys($r['hashes']??[])!==array_keys($m['files'])
       ||array_keys($r['before_hashes']??[])!==array_keys($m['files'])
       ||!preg_match('/^[a-f0-9]{64}$/D',$r['marketing_receipt_sha256']??''))throw new RuntimeException('PRICING_RECEIPT_INVALID');
    $marketingReceipt=hznPCPath($home,'.horizons-demo-marketing/receipt.json');
    if(!hash_equals($r['marketing_receipt_sha256'],hash('sha256',hznPCRead($marketingReceipt,65536))))throw new RuntimeException('PRICING_MARKETING_RECEIPT_CHANGED');
    foreach($m['files'] as $relative=>$entry){
        $before=hznPCPath($private,'baseline/'.$relative);$current=hznPCPath($web,$relative);
        if($r['hashes'][$relative]!==$entry['sha256']||$r['before_hashes'][$relative]!==$entry['before']
           ||!is_file($before)||(fileperms($before)&0777)!==0600
           ||!hash_equals($entry['before'],hash('sha256',hznPCRead($before,524288)))
           ||!is_file($current)||(fileperms($current)&0777)!==0644
           ||!hash_equals($entry['sha256'],hash('sha256',hznPCRead($current,524288))))
           throw new RuntimeException('PRICING_PUBLIC_CHANGED');
    }
    return $r;
}
