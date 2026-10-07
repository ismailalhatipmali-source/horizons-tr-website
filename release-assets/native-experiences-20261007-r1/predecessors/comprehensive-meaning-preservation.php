<?php
declare(strict_types=1);
// One paired successor. All older receipts and their baselines remain immutable.
const HZN_COMPREHENSIVE_MEANING_RELEASE = 'comprehensive-meaning-20261004-r1';
const HZN_COMPREHENSIVE_MEANING_MANIFEST_SHA256 = '488bbaee728c687fbb7bd4f5b308778648dd8eaef9fadf4558cf76bbd582b530';
const HZN_COMPREHENSIVE_MEANING_DEMO_MANIFEST_SHA256 = '4ae2afa672ed4ab2c6236a256c535b0557b1dd7b8cb9740994ad2735e77575af';
const HZN_COMPREHENSIVE_MEANING_PATHS = ['try/index.html','try/workbook.js','try/sw.js','learn/index.html','try/demo-asset-manifest.json','try/demo-experience.css','learn/sw.js','learn/asset-manifest.json','learn/content/1.4.1/workbook.js.hzn'];
const HZN_COMPREHENSIVE_MEANING_SOURCES = ['src/workbook-web/story-meaning-control.js','src/demo-pwa/demo-meaning-extension.js','src/demo-pwa/demo-meanings-locales.json'];
const HZN_COMPREHENSIVE_MEANING_RECEIPTS = ['.horizons-creator-public/receipt.json','.horizons-demo-experience/receipt.json','.horizons-workbook-responsive/receipt.json','.horizons-blending3/receipt.json'];
const HZN_COMPREHENSIVE_MEANING_WORKER_SUFFIX = 'blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1';
function hznCMPath(string $root,string $relative):string {
    if(!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative))throw new RuntimeException('COMPREHENSIVE_PATH_INVALID');
    $current=rtrim($root,'/');foreach(explode('/',$relative) as $part){if($part==='.'||$part==='..')throw new RuntimeException('COMPREHENSIVE_PATH_INVALID');$current.='/'.$part;if(is_link($current))throw new RuntimeException('COMPREHENSIVE_SYMLINK_REJECTED');}return $current;
}
function hznCMRead(string $path):string {
    if(is_link($path)||!is_file($path)||filesize($path)>41943040)throw new RuntimeException('COMPREHENSIVE_FILE_INVALID');
    $raw=file_get_contents($path);if($raw===false)throw new RuntimeException('COMPREHENSIVE_READ_FAILED');return $raw;
}
function hznCMJson(array $value):string {return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function hznCMWorker(string $before,bool $paid):string {
    if($paid){$old="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';";$new="const SHELL = 'hzn-web-shell-' + VERSION + '-".HZN_COMPREHENSIVE_MEANING_WORKER_SUFFIX."';";if(substr_count($before,$old)!==1)throw new RuntimeException('COMPREHENSIVE_PAID_WORKER_BASELINE_CHANGED');return str_replace($old,$new,$before);}
    $old="const CACHE='hzn-public-demo-'+VERSION+'-demo-experience-20261004-r1';";$new="const CACHE='hzn-public-demo-'+VERSION+'-comprehensive-meaning-20261004-r1';";
    $pattern='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience)-\\d{8}-r\\d+)?$/';$replacement='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience|comprehensive-meaning)-\\d{8}-r\\d+)?$/';
    if(substr_count($before,$old)!==1||substr_count($before,$pattern)!==1)throw new RuntimeException('COMPREHENSIVE_DEMO_WORKER_BASELINE_CHANGED');return str_replace([$old,$pattern],[$new,$replacement],$before);
}
function hznCMRelease(string $repo):array {
    $relative='release-assets/'.HZN_COMPREHENSIVE_MEANING_RELEASE.'/manifest.json';$raw=hznCMRead(hznCMPath($repo,$relative));
    if(!hash_equals(HZN_COMPREHENSIVE_MEANING_MANIFEST_SHA256,hash('sha256',$raw)))throw new RuntimeException('COMPREHENSIVE_RELEASE_CHANGED');
    $release=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if(($release['schema']??null)!==1||($release['version']??'')!==HZN_COMPREHENSIVE_MEANING_RELEASE
        ||($release['predecessor_demo_manifest_sha256']??'')!==HZN_COMPREHENSIVE_MEANING_DEMO_MANIFEST_SHA256
        ||array_keys($release['files']??[])!==array_slice(HZN_COMPREHENSIVE_MEANING_PATHS,0,7)
        ||array_keys($release['input_sources']??[])!==HZN_COMPREHENSIVE_MEANING_SOURCES
        ||count($release['interface_languages']??[])!==32||count(array_unique($release['interface_languages']??[]))!==32
        ||($release['free_word_count']??0)!==100||($release['free_story_count']??0)!==10||($release['demo_curriculum_count']??0)!==497)throw new RuntimeException('COMPREHENSIVE_RELEASE_INVALID');
    foreach($release['input_sources'] as $name=>$sha)if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznCMRead(hznCMPath($repo,$name)))))throw new RuntimeException('COMPREHENSIVE_SOURCE_CHANGED');
    $priorRaw=hznCMRead(hznCMPath($repo,'release-assets/demo-experience-20261004-r1/manifest.json'));
    if(!hash_equals(HZN_COMPREHENSIVE_MEANING_DEMO_MANIFEST_SHA256,hash('sha256',$priorRaw)))throw new RuntimeException('COMPREHENSIVE_PREDECESSOR_CHANGED');$prior=json_decode($priorRaw,true,32,JSON_THROW_ON_ERROR);
    foreach($release['files'] as $name=>$entry)if(($entry['source']??'')!=='release-assets/'.HZN_COMPREHENSIVE_MEANING_RELEASE.'/files/'.$name||($entry['before']??'')!==($prior['files'][$name]['sha256']??'')||!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>2097152||!preg_match('/^[a-f0-9]{64}$/D',$entry['sha256']??''))throw new RuntimeException('COMPREHENSIVE_PAYLOAD_INVALID');
    return $release;
}
function hznCMState(string $web):?array {
    require_once __DIR__.'/blending4-preservation.php';
    $focus=hznFocusState($web);$blending4=hznB4State($web);
    $home=dirname($web);$private=hznCMPath($home,'.horizons-comprehensive-meaning');$path=hznCMPath($private,'receipt.json');if(!is_file($path))return null;
    if(realpath($private)!==$private||(fileperms($private)&0777)!==0700||realpath($path)!==$path||(fileperms($path)&0777)!==0600||filesize($path)>65536)throw new RuntimeException('COMPREHENSIVE_PRIVATE_RECEIPT_REQUIRED');
    $receipt=json_decode(hznCMRead($path),true,16,JSON_THROW_ON_ERROR);$release=hznCMRelease(dirname(__DIR__));
    if(($receipt['schema']??null)!==1||($receipt['patch']??'')!==HZN_COMPREHENSIVE_MEANING_RELEASE
        ||($receipt['manifest_sha256']??'')!==HZN_COMPREHENSIVE_MEANING_MANIFEST_SHA256||($receipt['sources']??[])!==$release['input_sources']
        ||array_keys($receipt['hashes']??[])!==HZN_COMPREHENSIVE_MEANING_PATHS||array_keys($receipt['before_hashes']??[])!==HZN_COMPREHENSIVE_MEANING_PATHS
        ||array_keys($receipt['before_modes']??[])!==HZN_COMPREHENSIVE_MEANING_PATHS||array_keys($receipt['inherited_receipts']??[])!==HZN_COMPREHENSIVE_MEANING_RECEIPTS
        ||($receipt['worker_suffix']??'')!==HZN_COMPREHENSIVE_MEANING_WORKER_SUFFIX
        ||!preg_match('/^[a-f0-9]{64}$/D',$receipt['plain_before_sha256']??'')||!preg_match('/^[a-f0-9]{64}$/D',$receipt['plain_after_sha256']??''))throw new RuntimeException('COMPREHENSIVE_RECEIPT_INVALID');
    $oldReceipts=[];foreach(HZN_COMPREHENSIVE_MEANING_RECEIPTS as $name){$file=hznCMPath($home,$name);$sha=$receipt['inherited_receipts'][$name];if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!hash_equals($sha,hash('sha256',hznCMRead($file))))throw new RuntimeException('COMPREHENSIVE_INHERITED_RECEIPT_CHANGED');$oldReceipts[$name]=json_decode(hznCMRead($file),true,32,JSON_THROW_ON_ERROR);}
    $demo=$oldReceipts['.horizons-demo-experience/receipt.json'];$paid=$oldReceipts['.horizons-workbook-responsive/receipt.json'];
    if(($demo['patch']??'')!=='demo-experience-20261004-r1'||($demo['manifest_sha256']??'')!==HZN_COMPREHENSIVE_MEANING_DEMO_MANIFEST_SHA256||($paid['patch']??'')!=='workbook-responsive-20261004-r3'||($paid['plain_after_sha256']??'')!==$receipt['plain_before_sha256'])throw new RuntimeException('COMPREHENSIVE_BASELINE_LINEAGE_INVALID');
    $expected=$demo['hashes'];$expected['learn/asset-manifest.json']=$paid['hashes']['asset-manifest.json'];$expected['learn/content/1.4.1/workbook.js.hzn']=$paid['hashes']['content/1.4.1/workbook.js.hzn'];
    if($receipt['before_hashes']!==$expected)throw new RuntimeException('COMPREHENSIVE_BASELINE_HASHES_INVALID');
    foreach(HZN_COMPREHENSIVE_MEANING_PATHS as $name){$file=hznB4PreviousPath($web,$name,$blending4,$focus);$backup=hznCMPath($private,'baseline/'.$name);$sha=$receipt['hashes'][$name];$before=$receipt['before_hashes'][$name];
        if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!is_file($file)||(fileperms($file)&0777)!==((($blending4!==null&&in_array($name,HZN_B4_SHARED,true))||($focus!==null&&in_array($name,HZN_FOCUS_PATHS,true)))?0600:0644)||!hash_equals($sha,hash_file('sha256',$file)))throw new RuntimeException('COMPREHENSIVE_PUBLIC_CHANGED');
        if(!is_file($backup)||(fileperms($backup)&0777)!==0600||!hash_equals($before,hash_file('sha256',$backup))||!is_int($receipt['before_modes'][$name])||$receipt['before_modes'][$name]<0||$receipt['before_modes'][$name]>0777)throw new RuntimeException('COMPREHENSIVE_BASELINE_CHANGED');
        if(isset($release['files'][$name])&&$before!==$release['files'][$name]['before'])throw new RuntimeException('COMPREHENSIVE_BASELINE_RELEASE_CHANGED');
        if(isset($release['files'][$name])&&($sha!==$release['files'][$name]['sha256']||filesize($file)!==$release['files'][$name]['bytes']))throw new RuntimeException('COMPREHENSIVE_RELEASE_PAYLOAD_CHANGED');
    }
    $baselineRoot=hznCMPath($private,'baseline');
    $old=json_decode(hznCMRead(hznCMPath($baselineRoot,'try/demo-asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);$new=json_decode(hznCMRead(hznFocusPreviousPath($web,'try/demo-asset-manifest.json',$focus)),true,32,JSON_THROW_ON_ERROR);$project=$new;$project['files']['workbook.js']=$old['files']['workbook.js'];
    if($project!==$old||($new['files']['workbook.js']['sha256']??'')!==$receipt['hashes']['try/workbook.js']||($new['files']['workbook.js']['bytes']??-1)!==filesize(hznFocusPreviousPath($web,'try/workbook.js',$focus)))throw new RuntimeException('COMPREHENSIVE_DEMO_CONTENT_CHANGED');
    $old=json_decode(hznCMRead(hznCMPath($baselineRoot,'learn/asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);$new=json_decode(hznCMRead(hznB4PreviousPath($web,'learn/asset-manifest.json',$blending4,$focus)),true,32,JSON_THROW_ON_ERROR);$project=$new;$project['files']['workbook.js']=$old['files']['workbook.js'];$entry=$new['files']['workbook.js'];
    if($project!==$old||($entry['sha256']??'')!==$receipt['hashes']['learn/content/1.4.1/workbook.js.hzn']||($entry['bytes']??-1)!==filesize(hznB4PreviousPath($web,'learn/content/1.4.1/workbook.js.hzn',$blending4,$focus))||($entry['encoding']??'')!=='gzip'||($entry['decoded_bytes']??0)<1||$entry['decoded_bytes']>33554432)throw new RuntimeException('COMPREHENSIVE_PAID_CONTENT_CHANGED');
    foreach(['try/sw.js'=>false,'learn/sw.js'=>true] as $name=>$paidWorker)if(hznCMWorker(hznCMRead(hznCMPath($baselineRoot,$name)),$paidWorker)!==hznCMRead(hznB4PreviousPath($web,$name,$blending4,$focus)))throw new RuntimeException('COMPREHENSIVE_WORKER_CHANGED');
    foreach(['try/index.html','learn/index.html','try/demo-experience.css'] as $name)if($receipt['hashes'][$name]!==$receipt['before_hashes'][$name])throw new RuntimeException('COMPREHENSIVE_UNRELATED_UI_CHANGED');
    $receipt['baseline_root']=$baselineRoot;
    if($blending4!==null){foreach(HZN_B4_SHARED as $p)$receipt['hashes'][$p]=$blending4['hashes'][$p];$receipt['plain_after_sha256']=$blending4['plain_after_sha256'];$receipt['worker_suffix']=$blending4['worker_suffix'];$receipt['blending4']=$blending4;}
    if($focus!==null){foreach(HZN_FOCUS_PUBLIC as $p)$receipt['hashes'][$p]=$focus['hashes'][$p];$receipt['workbook_focus']=$focus;}
    return $receipt;
}
