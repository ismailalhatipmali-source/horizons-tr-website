<?php
declare(strict_types=1);
require dirname(__DIR__).'/scripts/workbook-focus-preservation.php';
require dirname(__DIR__).'/scripts/native-ui-state.php';
$root=dirname(__DIR__);$tmp=sys_get_temp_dir().'/hzn-historical-pins-'.bin2hex(random_bytes(8));mkdir($tmp,0700);
$native=json_decode(file_get_contents($root.'/release-assets/'.HZN_UI_RELEASE.'/manifest.json'),true);
$focus=json_decode(file_get_contents($root.'/release-assets/'.HZN_FOCUS_RELEASE.'/manifest.json'),true);
$paths=array_merge(array_keys($native['code']),array_map(fn($p)=>'src/workbook-experiences/'.$p,array_keys($native['sources'])),array_keys($focus['sources']),
    ['release-assets/'.HZN_UI_RELEASE.'/manifest.json','release-assets/'.HZN_UI_RELEASE.'/manifest.sha256','release-assets/'.HZN_FOCUS_RELEASE.'/manifest.json','release-assets/'.HZN_FOCUS_RELEASE.'/manifest.sha256',$focus['compiled_hook']['source']],
    array_column($focus['files'],'source'));
foreach(array_unique($paths) as $p){if(!is_dir(dirname($tmp.'/'.$p)))mkdir(dirname($tmp.'/'.$p),0700,true);copy($root.'/'.$p,$tmp.'/'.$p);}
function pinReject(callable $f):void{try{$f();}catch(RuntimeException $e){if($e->getMessage()==='UI_RELEASE_CODE')return;throw $e;}throw new RuntimeException('PIN_ACCEPTED_TAMPER');}
try{
    hznFocusRelease($tmp);echo "PASS real_historical_focus_manifest_accepts_pinned_successor\n";
    $p=$tmp.'/scripts/comprehensive-meaning-preservation.php';$raw=file_get_contents($p);file_put_contents($p,$raw."\n// foreign edit\n");pinReject(fn()=>hznFocusRelease($tmp));file_put_contents($p,$raw);echo "PASS modified_successor_is_rejected\n";
    $p=$tmp.'/release-assets/'.HZN_UI_RELEASE.'/predecessors/comprehensive-meaning-preservation.php';$raw=file_get_contents($p);file_put_contents($p,$raw."\n// foreign archive\n");pinReject(fn()=>hznFocusRelease($tmp));file_put_contents($p,$raw);echo "PASS modified_historical_archive_is_rejected\n";
    if($native['code']['release-assets/'.HZN_UI_RELEASE.'/predecessors/comprehensive-meaning-preservation.php']!==$focus['sources']['scripts/comprehensive-meaning-preservation.php'])throw new RuntimeException('HISTORICAL_SOURCE_PIN_MISMATCH');
    echo "RESULT 3/3 passed\n";
}finally{
    $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $x){$x->isDir()?rmdir($x->getPathname()):unlink($x->getPathname());}rmdir($tmp);
}
