<?php
declare(strict_types=1);
// Generic verification only. No paid words, meanings, images or raw recordings.
function hznB3Path(string $root,string $relative):string {
    if($relative===''||preg_match('/[\\\\\x00-\x1f?#]/',$relative))throw new RuntimeException('BLENDING3_PATH_INVALID');
    $path=$root;
    foreach(explode('/',$relative) as $part){if($part===''||$part==='.'||$part==='..')throw new RuntimeException('BLENDING3_PATH_INVALID');$path.='/'.$part;if(is_link($path))throw new RuntimeException('SYMLINK_REJECTED');}
    return $path;
}
function hznB3Read(string $path):string {$b=file_get_contents($path);if($b===false)throw new RuntimeException('BLENDING3_READ_FAILED');return $b;}
function hznB3Json(array $x):string {return json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function hznB3State(string $web):?array {
    $home=dirname($web);$state=hznB3Path($home,'.horizons-blending3');$path=hznB3Path($state,'receipt.json');if(!is_file($path))return null;
    if(realpath($path)!==$path||str_starts_with($path,$web.'/')||filesize($path)>262144)throw new RuntimeException('BLENDING3_PRIVATE_RECEIPT_REQUIRED');
    $receiptRaw=hznB3Read($path);$receipt=json_decode($receiptRaw,true,32,JSON_THROW_ON_ERROR);
    if(($receipt['schema']??null)!==1||($receipt['patch']??'')!=='blending3-20261004-r2'||($receipt['word_count']??0)!==150||($receipt['approved_clips']??0)!==150||($receipt['practice_count']??0)!==12||count($receipt['hashes']??[])!==153)throw new RuntimeException('BLENDING3_RECEIPT_INVALID');
    foreach(['release_sha256','baseline_manifest_sha256','baseline_sw_sha256','plain_workbook_sha256'] as $key)if(!preg_match('/^[a-f0-9]{64}$/D',$receipt[$key]??''))throw new RuntimeException('BLENDING3_RECEIPT_INVALID');
    $responsive=null;$responsiveBridge=__DIR__.'/workbook-responsive-preservation.php';
    if(is_file($responsiveBridge)){require_once $responsiveBridge;$responsive=hznResponsiveState($web,$receipt,hash('sha256',$receiptRaw));}
    elseif(is_file(dirname($web).'/.horizons-workbook-responsive/receipt.json'))throw new RuntimeException('RESPONSIVE_BRIDGE_REQUIRED');
    if($responsive!==null){foreach($responsive['hashes'] as $p=>$sha)$receipt['hashes'][$p]=$sha;$receipt['plain_workbook_sha256']=$responsive['plain_after_sha256'];}
    $learn=hznB3Path($web,'learn');$expected=['asset-manifest.json','sw.js','content/1.4.1/workbook.js.hzn'];
    $paths=$receipt['audio_paths']??[];if(count($paths)!==150||count(array_unique($paths))!==150)throw new RuntimeException('BLENDING3_AUDIO_COUNT_INVALID');
    foreach($paths as $p){if(!preg_match('~^course/audio/blending3/blending3_r2_0[123]_[0-9]{3}\.wav$~D',$p))throw new RuntimeException('BLENDING3_AUDIO_PATH_INVALID');$expected[]='content/1.4.1/'.$p.'.hzn';}
    $actual=array_keys($receipt['hashes']);sort($actual);sort($expected);if($actual!==$expected)throw new RuntimeException('BLENDING3_RECEIPT_INVALID');
    foreach($receipt['hashes'] as $p=>$sha){$file=hznB3Path($learn,$p);if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!is_file($file)||!hash_equals($sha,hash_file('sha256',$file)))throw new RuntimeException('BLENDING3_ASSET_CHANGED');}
    $baselinePath=hznB3Path($state,'baseline-manifest.json');$workerPath=hznB3Path($state,'baseline-sw.js');
    if(!is_file($baselinePath)||filesize($baselinePath)>4194304||!hash_equals($receipt['baseline_manifest_sha256'],hash_file('sha256',$baselinePath))||!is_file($workerPath)||!hash_equals($receipt['baseline_sw_sha256'],hash_file('sha256',$workerPath)))throw new RuntimeException('BLENDING3_BASELINE_DAMAGED');
    $baseline=json_decode(hznB3Read($baselinePath),true,32,JSON_THROW_ON_ERROR);
    $manifest=json_decode(hznB3Read(hznB3Path($learn,'asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
    if(($manifest['blending3_release']??'')!==$receipt['patch']||($manifest['blending3_word_count']??0)!==150||($manifest['blending3_practice_count']??0)!==12||($manifest['blending3_approved_clips']??0)!==150||($manifest['blending3_lesson_count']??0)!==25||($manifest['blending3_languages']??[])!==($baseline['meaning_languages']??[]))throw new RuntimeException('BLENDING3_MANIFEST_INVALID');
    foreach($paths as $p){$e=$manifest['files'][$p]??[];$file=hznB3Path($learn,'content/1.4.1/'.$p.'.hzn');if(($e['url']??'')!=='content/1.4.1/'.$p.'.hzn'||($e['mime']??'')!=='audio/wav'||($e['sha256']??'')!==$receipt['hashes'][$e['url']]||filesize($file)!==($e['bytes']??-1))throw new RuntimeException('BLENDING3_AUDIO_INVALID');}
    if(($manifest['groups']['blending3']??[])!==array_merge(['workbook.js'],$paths))throw new RuntimeException('BLENDING3_GROUP_INVALID');
    $e=$manifest['files']['workbook.js']??[];
    if(($e['url']??'')!=='content/1.4.1/workbook.js.hzn'||($e['sha256']??'')!==$receipt['hashes'][$e['url']]||filesize(hznB3Path($learn,$e['url']))!==($e['bytes']??-1)||($e['encoding']??'')!=='gzip'||($e['decoded_bytes']??0)<1||$e['decoded_bytes']>33554432)throw new RuntimeException('BLENDING3_APPLICATION_INVALID');
    $b4=$responsive['comprehensive_meaning']['blending4']??null;
    $projected=$b4===null?$manifest:$b4['baseline_manifest'];foreach($paths as $p)unset($projected['files'][$p]);$projected['files']['workbook.js']=$baseline['files']['workbook.js'];unset($projected['groups']['blending3']);
    $projected['groups']['all']=array_values(array_filter($projected['groups']['all'],fn($p)=>!in_array($p,$paths,true)));
    foreach(['blending3_release','blending3_word_count','blending3_practice_count','blending3_approved_clips','blending3_lesson_count','blending3_languages'] as $key)unset($projected[$key]);
    if(hznB3Json($projected)!==hznB3Json($baseline))throw new RuntimeException('BLENDING3_PREVIOUS_CONTENT_CHANGED');
    $suffix=$responsive===null?'blending3-20261004-r2':$responsive['worker_suffix'];
    $old="const SHELL = 'hzn-web-shell-' + VERSION + '-meanings-20261003-r1';";$new="const SHELL = 'hzn-web-shell-' + VERSION + '-".$suffix."';";
    $before=hznB3Read($workerPath);if(substr_count($before,$old)!==1||str_replace($old,$new,$before)!==hznB3Read(hznB3Path($learn,'sw.js')))throw new RuntimeException('BLENDING3_WORKER_CHANGED');
    $oldMeaning=hznB3Path($home,'.horizons-meaning/receipt.json');if(!is_file($oldMeaning)||!hash_equals($receipt['inherited_meaning_receipt_sha256']??'',hash_file('sha256',$oldMeaning)))throw new RuntimeException('BLENDING3_INHERITED_RECEIPT_CHANGED');
    return ['manifest'=>$manifest,'baseline'=>$baseline,'receipt'=>$receipt,'worker_suffix'=>$suffix,'responsive_receipt'=>$responsive];
}
