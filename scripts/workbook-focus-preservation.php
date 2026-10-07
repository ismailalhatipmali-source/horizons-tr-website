<?php
declare(strict_types=1);
// UI-only successor. Historical receipts and educational assets remain immutable.
const HZN_FOCUS_RELEASE = 'workbook-focus-20261005-r1';
const HZN_FOCUS_PATHS = ['try/workbook.js','try/demo-asset-manifest.json','try/sw.js','learn/content/1.4.1/workbook.js.hzn','learn/asset-manifest.json','learn/sw.js'];
const HZN_FOCUS_PUBLIC = ['try/workbook.js','try/demo-asset-manifest.json','try/sw.js'];
const HZN_FOCUS_SOURCES = ['src/workbook-focus/focus-shell.js','src/workbook-focus/focus-shell.css','src/workbook-focus/focus-locales.json','src/workbook-focus/blending4-component.js','src/workbook-focus/blending4-component.css','scripts/comprehensive-meaning-preservation.php','scripts/blending4-preservation.php'];
const HZN_FOCUS_PAID_SUFFIX = 'blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1-blending4-20261004-r1-workbook-focus-20261005-r1';
function hznFocusPath(string $root,string $relative):string {
    if(!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative))throw new RuntimeException('FOCUS_PATH_INVALID');
    $path=rtrim($root,'/');foreach(explode('/',$relative) as $part){if($part==='.'||$part==='..')throw new RuntimeException('FOCUS_PATH_INVALID');$path.='/'.$part;if(is_link($path))throw new RuntimeException('FOCUS_SYMLINK_REJECTED');}return $path;
}
function hznFocusRead(string $path,int $limit=41943040):string {
    if(is_link($path)||!is_file($path)||filesize($path)>$limit)throw new RuntimeException('FOCUS_FILE_INVALID');$raw=file_get_contents($path);if($raw===false)throw new RuntimeException('FOCUS_READ_FAILED');return $raw;
}
function hznFocusJson(array $value):string{return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function hznFocusSha(string $value):bool{return (bool)preg_match('/^[a-f0-9]{64}$/D',$value);}
function hznFocusRelease(string $repo):array {
    $prefix='release-assets/'.HZN_FOCUS_RELEASE;$raw=hznFocusRead(hznFocusPath($repo,$prefix.'/manifest.json'),131072);
    $pin=trim(hznFocusRead(hznFocusPath($repo,$prefix.'/manifest.sha256'),128));
    if(!hznFocusSha($pin)||!hash_equals($pin,hash('sha256',$raw)))throw new RuntimeException('FOCUS_RELEASE_CHANGED');
    $r=json_decode($raw,true,32,JSON_THROW_ON_ERROR);$sources=array_keys($r['sources']??[]);$expected=HZN_FOCUS_SOURCES;
    if(in_array('src/workbook-focus/blending3-responsive.css',$sources,true)||in_array('src/workbook-focus/blending3-component.js',$sources,true))$expected=array_merge($expected,['src/workbook-focus/blending3-responsive.css','src/workbook-focus/blending3-component.js']);sort($sources);sort($expected);
    if(($r['schema']??0)!==1||($r['release']??'')!==HZN_FOCUS_RELEASE||$sources!==$expected||array_keys($r['files']??[])!==HZN_FOCUS_PUBLIC||count($r['languages']??[])!==32||count(array_unique($r['languages']))!==32)throw new RuntimeException('FOCUS_RELEASE_INVALID');
    foreach($r['sources'] as $p=>$sha){
        if(!is_string($sha)||!hznFocusSha($sha))throw new RuntimeException('FOCUS_SOURCE_CHANGED');
        $source=hznFocusPath($repo,$p);
        if(in_array($p,['scripts/comprehensive-meaning-preservation.php','scripts/blending4-preservation.php'],true)&&!hash_equals($sha,hash('sha256',hznFocusRead($source,2097152)))){
            // Keep the installed focus manifest and receipt immutable. The new
            // validator and byte-exact historical source are pinned together.
            require_once __DIR__.'/native-ui-state.php';
            $nativeRelease=hznUiRelease($repo);
            $historical='release-assets/native-experiences-20261007-r1/predecessors/'.basename($p);
            if(($nativeRelease['code'][$historical]??'')!==$sha||!isset($nativeRelease['code'][$p]))throw new RuntimeException('FOCUS_SUCCESSOR_SOURCE_UNPINNED');
            $source=hznFocusPath($repo,$historical);
        }
        if(!hash_equals($sha,hash('sha256',hznFocusRead($source,2097152))))throw new RuntimeException('FOCUS_SOURCE_CHANGED');
    }
    $hook=$r['compiled_hook']??[];if(($hook['source']??'')!==$prefix.'/focus-hook.js')throw new RuntimeException('FOCUS_HOOK_INVALID');
    foreach(array_merge($r['files'],['hook'=>$hook]) as $p=>$entry){
        if($p!=='hook'&&(($entry['source']??'')!==$prefix.'/files/'.$p||!hznFocusSha($entry['before']??'')))throw new RuntimeException('FOCUS_PAYLOAD_INVALID');
        if(!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>4194304||!hznFocusSha($entry['sha256']??''))throw new RuntimeException('FOCUS_PAYLOAD_INVALID');
        $bytes=hznFocusRead(hznFocusPath($repo,$entry['source']),4194304);if(strlen($bytes)!==$entry['bytes']||!hash_equals($entry['sha256'],hash('sha256',$bytes)))throw new RuntimeException('FOCUS_PAYLOAD_CHANGED');
    }
    $r['manifest_sha256']=$pin;return $r;
}
function hznFocusHook(string $repo,array $release):string {
    $hook=hznFocusRead(hznFocusPath($repo,$release['compiled_hook']['source']),4194304);
    foreach(['/*WORKBOOK_FOCUS_BEGIN*/','/*WORKBOOK_FOCUS_END*/'] as $marker)if(substr_count($hook,$marker)!==1)throw new RuntimeException('FOCUS_HOOK_INVALID');
    return "\n".rtrim($hook,"\r\n")."\n";
}
function hznFocusWorker(string $before,bool $paid):string {
    if($paid){$old="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1-blending4-20261004-r1';";$new="const SHELL = 'hzn-web-shell-' + VERSION + '-".HZN_FOCUS_PAID_SUFFIX."';";if(substr_count($before,$old)!==1)throw new RuntimeException('FOCUS_WORKER_BASELINE_CHANGED');return str_replace($old,$new,$before);}
    $old="const CACHE='hzn-public-demo-'+VERSION+'-comprehensive-meaning-20261004-r1';";$new="const CACHE='hzn-public-demo-'+VERSION+'-".HZN_FOCUS_RELEASE."';";
    $pattern='(?:creator-credit|demo-experience|comprehensive-meaning)';$replacement='(?:creator-credit|demo-experience|comprehensive-meaning|workbook-focus)';
    if(substr_count($before,$old)!==1||substr_count($before,$pattern)<1)throw new RuntimeException('FOCUS_DEMO_WORKER_BASELINE_CHANGED');return str_replace([$old,$pattern],[$new,$replacement],$before);
}
function hznFocusPatch(string $plain,string $repo,array $release,bool $paid):string {
    $tail="\ninit();\n\n})();";$hook=hznFocusHook($repo,$release);
    if(substr_count($plain,$tail)!==1||str_contains($plain,'/*WORKBOOK_FOCUS_BEGIN*/'))throw new RuntimeException('FOCUS_APPLICATION_HOOK_CHANGED');
    $updated=$plain;$replacements=[];
    if(!$paid){
        $replacements=[
            ["function buttonStatus(section){return section==='blending4'?text('comingSoon'):['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}","function buttonStatus(section){return ['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}"],
            ['${section===\'blending4\'?\'is-coming-soon\':[\'alphabet\',\'catalog\'].includes(section)?\'is-free\':\'is-locked\'}','${[\'alphabet\',\'catalog\'].includes(section)?\'is-free\':\'is-locked\'}'],
            ["panelMarkup(text(preview),preview==='blending4')","panelMarkup(text(preview),false)"]
        ];
        foreach($replacements as [$old,$new]){if(substr_count($updated,$old)!==1||str_contains($updated,$new))throw new RuntimeException('FOCUS_DEMO_STATUS_HOOK_CHANGED');$updated=str_replace($old,$new,$updated);}
    }
    if($paid){
        $oldComponent=hznFocusRead(hznFocusPath($repo,'src/workbook-web/blending4-component.js'));
        $newComponent=hznFocusRead(hznFocusPath($repo,'src/workbook-focus/blending4-component.js'));
        $extension=hznFocusRead(hznFocusPath($repo,'src/workbook-web/blending4-extension.js'));
        if(!preg_match('/^const B4_CSS=.*;$/m',$extension,$match))throw new RuntimeException('FOCUS_COMPONENT_HOOK_CHANGED');
        $newCss='const B4_CSS='.json_encode(hznFocusRead(hznFocusPath($repo,'src/workbook-focus/blending4-component.css')),JSON_HEX_TAG|JSON_THROW_ON_ERROR).';';
        $replacements=[[$oldComponent,$newComponent],[$match[0],$newCss]];
        if(isset($release['sources']['src/workbook-focus/blending3-component.js'])){
            $start='function mountBlending3Component(root,DATA,config){';
            $oldSource=hznFocusRead(hznFocusPath($repo,'src/workbook-web/blending3-component.js'));$oldAt=strpos($oldSource,$start);
            $newSource=hznFocusRead(hznFocusPath($repo,'src/workbook-focus/blending3-component.js'));$newAt=strpos($newSource,$start);
            if($oldAt===false||$newAt===false)throw new RuntimeException('FOCUS_BLENDING3_HOOK_CHANGED');
            $oldB3=rtrim(substr($oldSource,$oldAt),"\r\n")."\n";$newB3=rtrim(substr($newSource,$newAt),"\r\n")."\n";
            $oldStyle=json_encode(hznFocusRead(hznFocusPath($repo,'src/workbook-web/blending3-responsive.css')),JSON_HEX_TAG|JSON_THROW_ON_ERROR);
            $newStyle=json_encode(hznFocusRead(hznFocusPath($repo,'src/workbook-focus/blending3-responsive.css')),JSON_HEX_TAG|JSON_THROW_ON_ERROR);
            $replacements[]=[$oldB3,$newB3];$replacements[]=[$oldStyle,$newStyle];
        }
        foreach($replacements as [$old,$new]){if(substr_count($updated,$old)!==1||($old!==$new&&str_contains($updated,$new)))throw new RuntimeException('FOCUS_COMPONENT_HOOK_CHANGED');$updated=str_replace($old,$new,$updated);}
    }
    $updated=str_replace($tail,$hook.$tail,$updated);$restored=str_replace($hook.$tail,$tail,$updated);
    foreach(array_reverse($replacements) as [$old,$new])$restored=str_replace($new,$old,$restored);
    if($restored!==$plain||strlen($updated)>33554432)throw new RuntimeException('FOCUS_CONTENT_PRESERVATION_FAILED');return $updated;
}
function hznFocusProjection(array $before,array $after,bool $paid):void {
    $a=$after;$a['files']['workbook.js']=$before['files']['workbook.js'];
    if($a!==$before)throw new RuntimeException($paid?'FOCUS_PAID_CONTENT_CHANGED':'FOCUS_DEMO_CONTENT_CHANGED');
}
// This function reads predecessor receipts directly: calling predecessor State() here
// would recurse through their successor bridge. They validate separately at the edge.
function hznFocusState(string $web):?array {
    require_once __DIR__.'/trial-pause-preservation.php';
    $trialPause=hznTrialPauseState($web);
    require_once __DIR__.'/native-ui-state.php';
    $nativeUi=hznUiState($web);$currentWeb=$nativeUi!==null?$nativeUi['baseline_root']:$web;
    $home=dirname($web);$private=hznFocusPath($home,'.horizons-workbook-focus');$path=hznFocusPath($private,'receipt.json');if(!is_file($path))return null;
    if(realpath($private)!==$private||(fileperms($private)&0777)!==0700||(fileperms($path)&0777)!==0600)throw new RuntimeException('FOCUS_PRIVATE_RECEIPT_REQUIRED');
    $r=json_decode(hznFocusRead($path,262144),true,32,JSON_THROW_ON_ERROR);$release=hznFocusRelease(dirname(__DIR__));
    if(($r['schema']??0)!==1||($r['release']??'')!==HZN_FOCUS_RELEASE||($r['manifest_sha256']??'')!==$release['manifest_sha256']||($r['sources']??[])!==$release['sources']||array_keys($r['hashes']??[])!==HZN_FOCUS_PATHS||array_keys($r['before_hashes']??[])!==HZN_FOCUS_PATHS||array_keys($r['before_modes']??[])!==HZN_FOCUS_PATHS||array_keys($r['inherited_receipts']??[])!==['.horizons-blending4/receipt.json','.horizons-comprehensive-meaning/receipt.json']||!hznFocusSha($r['plain_after_sha256']??''))throw new RuntimeException('FOCUS_RECEIPT_INVALID');
    $prior=[];foreach($r['inherited_receipts'] as $p=>$sha){$raw=hznFocusRead(hznFocusPath($home,$p),262144);if(!hznFocusSha($sha)||!hash_equals($sha,hash('sha256',$raw)))throw new RuntimeException('FOCUS_PREVIOUS_RECEIPT_CHANGED');$prior[$p]=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}
    $b4=$prior['.horizons-blending4/receipt.json'];$cm=$prior['.horizons-comprehensive-meaning/receipt.json'];
    if(($b4['release']??'')!=='blending4-20261004-r1'||($cm['patch']??'')!=='comprehensive-meaning-20261004-r1'||($r['plain_before_sha256']??'')!==($b4['plain_after_sha256']??'')||!hznFocusSha($r['plain_before_sha256']??''))throw new RuntimeException('FOCUS_LINEAGE_INVALID');
    $base=hznFocusPath($private,'baseline');
    foreach(HZN_FOCUS_PATHS as $p){$expected=str_starts_with($p,'try/')?($cm['hashes'][$p]??''):($b4['hashes'][$p]??'');$backup=hznFocusPath($base,$p);$target=hznFocusPath($trialPause!==null&&$p==='learn/sw.js'?$trialPause['baseline_root']:$currentWeb,$p);
        if(($r['before_hashes'][$p]??'')!==$expected||!hznFocusSha($expected)||!hash_equals($expected,hash('sha256',hznFocusRead($backup)))||(fileperms($backup)&0777)!==0600||$r['before_modes'][$p]!==0644)throw new RuntimeException('FOCUS_BASELINE_CHANGED');
        $targetMode=($trialPause!==null&&$p==='learn/sw.js')||$nativeUi!==null?0600:0644;
        if(!hznFocusSha($r['hashes'][$p]??'')||!hash_equals($r['hashes'][$p],hash('sha256',hznFocusRead($target)))||(fileperms($target)&0777)!==$targetMode)throw new RuntimeException('FOCUS_PUBLIC_CHANGED');
        if(isset($release['files'][$p])&&($expected!==$release['files'][$p]['before']||$r['hashes'][$p]!==$release['files'][$p]['sha256']))throw new RuntimeException('FOCUS_PUBLIC_RELEASE_CHANGED');
    }
    foreach(['try'=>false,'learn'=>true] as $edition=>$paid){$manifest=$paid?'asset-manifest.json':'demo-asset-manifest.json';$old=json_decode(hznFocusRead(hznFocusPath($base,$edition.'/'.$manifest)),true,32,JSON_THROW_ON_ERROR);$new=json_decode(hznFocusRead(hznFocusPath($currentWeb,$edition.'/'.$manifest)),true,32,JSON_THROW_ON_ERROR);hznFocusProjection($old,$new,$paid);$app=$paid?'learn/content/1.4.1/workbook.js.hzn':'try/workbook.js';$entry=$new['files']['workbook.js']??[];
        if(($entry['sha256']??'')!==$r['hashes'][$app]||($entry['bytes']??0)!==filesize(hznFocusPath($currentWeb,$app)))throw new RuntimeException('FOCUS_MANIFEST_INVALID');
        if($paid&&(($entry['encoding']??'')!=='gzip'||($entry['decoded_bytes']??0)<1||$entry['decoded_bytes']>33554432))throw new RuntimeException('FOCUS_APPLICATION_INVALID');
        $workerRoot=$trialPause!==null&&$paid?$trialPause['baseline_root']:$currentWeb;
        if(hznFocusWorker(hznFocusRead(hznFocusPath($base,$edition.'/sw.js')),$paid)!==hznFocusRead(hznFocusPath($workerRoot,$edition.'/sw.js')))throw new RuntimeException('FOCUS_WORKER_CHANGED');
    }
    if(hznFocusPatch(hznFocusRead(hznFocusPath($base,'try/workbook.js')),dirname(__DIR__),$release,false)!==hznFocusRead(hznFocusPath($currentWeb,'try/workbook.js')))throw new RuntimeException('FOCUS_DEMO_PATCH_CHANGED');
    $r['baseline_root']=$base;$r['worker_suffix']=HZN_FOCUS_PAID_SUFFIX;return $r;
}
function hznFocusPreviousPath(string $web,string $relative,?array $focus):string{return hznFocusPath($focus!==null&&in_array($relative,HZN_FOCUS_PATHS,true)?$focus['baseline_root']:$web,$relative);}
