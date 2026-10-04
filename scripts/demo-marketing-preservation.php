<?php
declare(strict_types=1);
// Exact public marketing paragraphs only. No app, media or commerce mutation.
const HZN_DEMO_MARKETING_RELEASE='demo-marketing-20261004-r1';
const HZN_DEMO_MARKETING_MANIFEST_SHA256='75314ed29500a894a867e25aeacd2329959bc63e1fecbd7efd56ee0f28f0f83e';
const HZN_DEMO_MARKETING_LANGUAGES=['en','ar','tr','fr','es','de','it','pt','nl','ru','uk','pl','cs','ro','hu','el','sv','da','no','fi','bg','sr','hr','he','fa','ur','hi','bn','id','ms','zh','ja'];
const HZN_DEMO_MARKETING_ANCESTORS=['.horizons-comprehensive-meaning/receipt.json','.horizons-creator-public/receipt.json','.horizons-demo-experience/receipt.json','.horizons-workbook-responsive/receipt.json','.horizons-blending3/receipt.json'];
function hznMCPaths():array {$paths=[];foreach(HZN_DEMO_MARKETING_LANGUAGES as $language)foreach(['demo','product'] as $page)$paths[]=$language.'/'.$page.'.html';return $paths;}
function hznMCPath(string $root,string $relative):string {
    if(!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative))throw new RuntimeException('MARKETING_PATH_INVALID');
    $current=rtrim($root,'/');foreach(explode('/',$relative) as $part){if($part==='.'||$part==='..')throw new RuntimeException('MARKETING_PATH_INVALID');$current.='/'.$part;if(is_link($current))throw new RuntimeException('MARKETING_SYMLINK_REJECTED');}return $current;
}
function hznMCRead(string $path):string {if(is_link($path)||!is_file($path)||filesize($path)>2097152)throw new RuntimeException('MARKETING_FILE_INVALID');$raw=file_get_contents($path);if($raw===false)throw new RuntimeException('MARKETING_READ_FAILED');return $raw;}
function hznMCJson(array $value):string {return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function hznMCEscape(string $text):string {return str_replace(['&','<','>','"',"'"],['&amp;','&lt;','&gt;','&quot;','&#x27;'],$text);}
function hznMCRelease(string $repo):array {
    $raw=hznMCRead(hznMCPath($repo,'release-assets/'.HZN_DEMO_MARKETING_RELEASE.'/manifest.json'));
    if(!hash_equals(HZN_DEMO_MARKETING_MANIFEST_SHA256,hash('sha256',$raw)))throw new RuntimeException('MARKETING_RELEASE_CHANGED');$release=json_decode($raw,true,32,JSON_THROW_ON_ERROR);$paths=hznMCPaths();
    $inputs=['src/demo-pwa/demo-marketing-locales.json'];foreach($paths as $path)$inputs[]='dist/'.$path;
    if(($release['schema']??null)!==1||($release['version']??'')!==HZN_DEMO_MARKETING_RELEASE||($release['interface_languages']??[])!==HZN_DEMO_MARKETING_LANGUAGES
        ||array_keys($release['files']??[])!==$paths||array_keys($release['input_sources']??[])!==$inputs||($release['approved_paragraph_count']??0)!==64
        ||array_keys($release['ancestor_marketing_manifests']??[])!==['release-assets/institution-20261003/manifest.json','release-assets/global-currency-20261002/manifest.json'])throw new RuntimeException('MARKETING_RELEASE_INVALID');
    foreach(array_merge($release['input_sources'],$release['ancestor_marketing_manifests']) as $path=>$sha)if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznMCRead(hznMCPath($repo,$path)))))throw new RuntimeException('MARKETING_SOURCE_CHANGED');
    $copy=json_decode(hznMCRead(hznMCPath($repo,'src/demo-pwa/demo-marketing-locales.json')),true,8,JSON_THROW_ON_ERROR);if(array_keys($copy)!==HZN_DEMO_MARKETING_LANGUAGES)throw new RuntimeException('MARKETING_COPY_LANGUAGES_INVALID');
    foreach($copy as $language=>$row)if(array_keys($row)!==['demo_intro','product_subtitle']||!is_string($row['demo_intro'])||trim($row['demo_intro'])===''||!is_string($row['product_subtitle'])||trim($row['product_subtitle'])==='')throw new RuntimeException('MARKETING_COPY_INVALID');
    foreach($release['files'] as $path=>$entry){$language=substr($path,0,2);$key=str_ends_with($path,'/demo.html')?'demo_intro':'product_subtitle';
        if(($entry['source']??'')!=='release-assets/'.HZN_DEMO_MARKETING_RELEASE.'/files/'.$path||($entry['baseline_source']??'')!=='dist/'.$path||($entry['before']??'')!==$release['input_sources']['dist/'.$path]
            ||($entry['slot_key']??'')!==$key||!is_string($entry['old_html']??null)||$entry['old_html']===''||!is_string($entry['new_html']??null)||$entry['new_html']!==hznMCEscape($copy[$language][$key])
            ||!preg_match('/^[a-f0-9]{64}$/D',$entry['sha256']??'')||!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>1048576)throw new RuntimeException('MARKETING_PAYLOAD_INVALID');
        $baseline=hznMCRead(hznMCPath($repo,$entry['baseline_source']));$new=hznMCReplace($baseline,$entry);
        if(!hash_equals($entry['sha256'],hash('sha256',$new))||strlen($new)!==$entry['bytes'])throw new RuntimeException('MARKETING_PARAGRAPH_PROOF_FAILED');
    }
    return $release;
}
function hznMCReplace(string $baseline,array $entry):string {
    $old='<p>'.$entry['old_html'].'</p>';$new='<p>'.$entry['new_html'].'</p>';
    if(substr_count($baseline,$old)!==1||substr_count($baseline,$new)!==0)throw new RuntimeException('MARKETING_PARAGRAPH_BASELINE_CHANGED');$updated=str_replace($old,$new,$baseline);
    if(substr_count($updated,$new)!==1||str_replace($new,$old,$updated)!==$baseline)throw new RuntimeException('MARKETING_UNRELATED_BYTES_CHANGED');return $updated;
}
function hznMCState(string $web):?array {
    $home=dirname($web);$private=hznMCPath($home,'.horizons-demo-marketing');$path=hznMCPath($private,'receipt.json');if(!is_file($path))return null;
    if(realpath($private)!==$private||(fileperms($private)&0777)!==0700||realpath($path)!==$path||(fileperms($path)&0777)!==0600||filesize($path)>65536)throw new RuntimeException('MARKETING_PRIVATE_RECEIPT_REQUIRED');
    $receipt=json_decode(hznMCRead($path),true,16,JSON_THROW_ON_ERROR);$release=hznMCRelease(dirname(__DIR__));$paths=hznMCPaths();
    if(($receipt['schema']??null)!==1||($receipt['patch']??'')!==HZN_DEMO_MARKETING_RELEASE||($receipt['manifest_sha256']??'')!==HZN_DEMO_MARKETING_MANIFEST_SHA256
        ||array_keys($receipt['hashes']??[])!==$paths||array_keys($receipt['before_hashes']??[])!==$paths||array_keys($receipt['before_modes']??[])!==$paths
        ||array_keys($receipt['inherited_receipts']??[])!==HZN_DEMO_MARKETING_ANCESTORS)throw new RuntimeException('MARKETING_RECEIPT_INVALID');
    foreach(HZN_DEMO_MARKETING_ANCESTORS as $name){$sha=$receipt['inherited_receipts'][$name];if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznMCRead(hznMCPath($home,$name)))))throw new RuntimeException('MARKETING_INHERITED_RECEIPT_CHANGED');}
    require_once __DIR__.'/comprehensive-meaning-preservation.php';if(hznCMState($web)===null)throw new RuntimeException('MARKETING_APPROVED_APP_REQUIRED');
    foreach($paths as $relative){$entry=$release['files'][$relative];$current=hznMCPath($web,$relative);$baseline=hznMCPath($private,'baseline/'.$relative);
        if($receipt['hashes'][$relative]!==$entry['sha256']||$receipt['before_hashes'][$relative]!==$entry['before']||!is_int($receipt['before_modes'][$relative])||$receipt['before_modes'][$relative]<0||$receipt['before_modes'][$relative]>0777)throw new RuntimeException('MARKETING_RECEIPT_HASHES_INVALID');
        if(!is_file($baseline)||(fileperms($baseline)&0777)!==0600||!hash_equals($entry['before'],hash_file('sha256',$baseline)))throw new RuntimeException('MARKETING_BASELINE_CHANGED');
        if(!is_file($current)||(fileperms($current)&0777)!==0644||!hash_equals($entry['sha256'],hash_file('sha256',$current))||hznMCReplace(hznMCRead($baseline),$entry)!==hznMCRead($current))throw new RuntimeException('MARKETING_PUBLIC_CHANGED');
    }
    return $receipt;
}
