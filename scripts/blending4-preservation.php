<?php
declare(strict_types=1);
// Section 05 successor: only hashes, generic code and encrypted assets are public.
const HZN_B4_RELEASE='blending4-20261004-r1';
const HZN_B4_RELEASE_SHA256='68059cbde172a66284d2f815a31d34c949e41f6b39c76597aa4a4bc8adb1b90a';
const HZN_B4_SHARED=['learn/asset-manifest.json','learn/sw.js','learn/content/1.4.1/workbook.js.hzn'];
const HZN_B4_META=['blending4_release','blending4_word_count','blending4_approved_clips','blending4_lesson_count','blending4_languages'];
function hznB4Path(string $root,string $relative):string{
 if(!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D',$relative))throw new RuntimeException('BLENDING4_PATH_INVALID');
 $p=rtrim($root,'/');foreach(explode('/',$relative) as $c){if($c==='.'||$c==='..')throw new RuntimeException('BLENDING4_PATH_INVALID');$p.='/'.$c;if(is_link($p))throw new RuntimeException('BLENDING4_SYMLINK_REJECTED');}return $p;
}
function hznB4Read(string $p,int $limit=33554432):string{if(is_link($p)||!is_file($p)||filesize($p)>$limit)throw new RuntimeException('BLENDING4_FILE_INVALID');$b=file_get_contents($p);if($b===false)throw new RuntimeException('BLENDING4_READ_FAILED');return $b;}
function hznB4Json(array $v):string{return json_encode($v,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
function hznB4Release(string $repo):array{
 $raw=hznB4Read(hznB4Path($repo,'release-assets/'.HZN_B4_RELEASE.'/manifest.json'),131072);
 if(!hash_equals(HZN_B4_RELEASE_SHA256,hash('sha256',$raw)))throw new RuntimeException('BLENDING4_RELEASE_CHANGED');$r=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if(($r['schema']??0)!==1||($r['release']??'')!==HZN_B4_RELEASE||($r['targets']??0)!==159||($r['lessons']??0)!==27||count($r['languages']??[])!==32||count($r['assets']??[])!==160)throw new RuntimeException('BLENDING4_RELEASE_INVALID');
 foreach($r['sources'] as $p=>$sha)if(!hash_equals($sha,hash('sha256',hznB4Read(hznB4Path($repo,$p)))))throw new RuntimeException('BLENDING4_SOURCE_CHANGED');
 $paths=['course/blending4/data.json'];for($i=1;$i<=159;$i++)$paths[]='course/audio/blending4/blending4_r1_'.str_pad((string)$i,3,'0',STR_PAD_LEFT).'.wav';
 if(array_keys($r['assets'])!==$paths)throw new RuntimeException('BLENDING4_ASSET_SCOPE_INVALID');
 foreach($r['assets'] as $p=>$e)if(!is_int($e['bytes']??null)||$e['bytes']<1||$e['bytes']>16000000||!preg_match('/^[a-f0-9]{64}$/D',$e['sha256']??'')||($e['mime']??'')!==($p===$paths[0]?'application/json':'audio/wav'))throw new RuntimeException('BLENDING4_ASSET_INVALID');
 return $r;
}
function hznB4Worker(string $before):string{
 $old="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1';";
 if(substr_count($before,$old)!==1)throw new RuntimeException('BLENDING4_WORKER_BASELINE_CHANGED');return str_replace($old,substr($old,0,-2).'-'.HZN_B4_RELEASE."';",$before);
}
function hznB4State(string $web):?array{
 $home=dirname($web);$private=hznB4Path($home,'.horizons-blending4');$receiptPath=hznB4Path($private,'receipt.json');if(!is_file($receiptPath))return null;
 if(realpath($private)!==$private||(fileperms($private)&0777)!==0700||(fileperms($receiptPath)&0777)!==0600)throw new RuntimeException('BLENDING4_PRIVATE_RECEIPT_REQUIRED');
 $r=json_decode(hznB4Read($receiptPath,262144),true,32,JSON_THROW_ON_ERROR);$release=hznB4Release(dirname(__DIR__));
 if(($r['schema']??0)!==1||($r['release']??'')!==HZN_B4_RELEASE||($r['release_sha256']??'')!==HZN_B4_RELEASE_SHA256||array_keys($r['before_hashes']??[])!==HZN_B4_SHARED||($r['sources']??[])!==$release['sources'])throw new RuntimeException('BLENDING4_RECEIPT_INVALID');
 $previousRaw=hznB4Read(hznB4Path($home,'.horizons-comprehensive-meaning/receipt.json'),65536);
 if(!hash_equals($r['previous_receipt_sha256']??'',hash('sha256',$previousRaw)))throw new RuntimeException('BLENDING4_PREVIOUS_RECEIPT_CHANGED');$previous=json_decode($previousRaw,true,24,JSON_THROW_ON_ERROR);
 if(($previous['patch']??'')!=='comprehensive-meaning-20261004-r1'||($r['plain_before_sha256']??'')!==($previous['plain_after_sha256']??'')||!preg_match('/^[a-f0-9]{64}$/D',$r['plain_after_sha256']??''))throw new RuntimeException('BLENDING4_LINEAGE_INVALID');
 $base=hznB4Path($private,'baseline');
 foreach(HZN_B4_SHARED as $p){$backup=hznB4Path($base,$p);if(($r['before_hashes'][$p]??'')!==($previous['hashes'][$p]??'')||(fileperms($backup)&0777)!==0600||!hash_equals($r['before_hashes'][$p],hash('sha256',hznB4Read($backup))))throw new RuntimeException('BLENDING4_BASELINE_CHANGED');}
 $expected=HZN_B4_SHARED;foreach(array_keys($release['assets']) as $p)$expected[]='learn/content/1.4.1/'.$p.'.hzn';
 if(array_keys($r['hashes']??[])!==$expected)throw new RuntimeException('BLENDING4_RECEIPT_SCOPE_INVALID');
 foreach($r['hashes'] as $p=>$sha){$target=hznB4Path($web,$p);if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||(fileperms($target)&0777)!==0644||!hash_equals($sha,hash('sha256',hznB4Read($target))))throw new RuntimeException('BLENDING4_PUBLIC_CHANGED');}
 $old=json_decode(hznB4Read(hznB4Path($base,'learn/asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);$new=json_decode(hznB4Read(hznB4Path($web,'learn/asset-manifest.json')),true,32,JSON_THROW_ON_ERROR);
 if(($new['blending4_release']??'')!==HZN_B4_RELEASE||($new['blending4_word_count']??0)!==159||($new['blending4_approved_clips']??0)!==159||($new['blending4_lesson_count']??0)!==27||($new['blending4_languages']??[])!==$release['languages']||($new['groups']['blending4']??[])!==array_merge(['workbook.js'],array_keys($release['assets'])))throw new RuntimeException('BLENDING4_MANIFEST_INVALID');
 foreach($release['assets'] as $p=>$asset){$e=$new['files'][$p]??[];$url='content/1.4.1/'.$p.'.hzn';if(($e['url']??'')!==$url||($e['mime']??'')!==$asset['mime']||($e['sha256']??'')!==$r['hashes']['learn/'.$url]||($e['bytes']??-1)!==filesize(hznB4Path($web,'learn/'.$url)))throw new RuntimeException('BLENDING4_CONTENT_INVALID');if($p==='course/blending4/data.json'&&(($e['encoding']??'')!=='gzip'||($e['decoded_bytes']??0)!==$asset['bytes']))throw new RuntimeException('BLENDING4_DATA_ENCODING_INVALID');}
 $e=$new['files']['workbook.js'];if($e['url']!=='content/1.4.1/workbook.js.hzn'||$e['sha256']!==$r['hashes']['learn/'.$e['url']]||$e['bytes']!==filesize(hznB4Path($web,'learn/'.$e['url']))||($e['encoding']??'')!=='gzip'||($e['decoded_bytes']??0)<1||$e['decoded_bytes']>33554432)throw new RuntimeException('BLENDING4_APPLICATION_INVALID');
 $projection=$new;foreach(array_keys($release['assets']) as $p)unset($projection['files'][$p]);$projection['files']['workbook.js']=$old['files']['workbook.js'];unset($projection['groups']['blending4']);$projection['groups']['all']=array_values(array_filter($projection['groups']['all'],fn($p)=>!isset($release['assets'][$p])));foreach(HZN_B4_META as $k)unset($projection[$k]);
 if($projection!==$old)throw new RuntimeException('BLENDING4_PRIOR_CONTENT_CHANGED');
 if(hznB4Worker(hznB4Read(hznB4Path($base,'learn/sw.js')))!==hznB4Read(hznB4Path($web,'learn/sw.js')))throw new RuntimeException('BLENDING4_WORKER_CHANGED');
 $r['baseline_root']=$base;$r['baseline_manifest']=$old;$r['worker_suffix']='blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1-'.HZN_B4_RELEASE;return $r;
}
function hznB4PreviousPath(string $web,string $relative,?array $b4):string{return hznB4Path($b4!==null&&in_array($relative,HZN_B4_SHARED,true)?$b4['baseline_root']:$web,$relative);}
