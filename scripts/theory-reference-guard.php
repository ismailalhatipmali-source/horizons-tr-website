<?php
declare(strict_types=1);
/* Strictly scoped reference helpers. Existing workbook licensing is reused;
 * no account database, activation settings or learner state is modified. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
const HZN_THEORY_AAD='horizons-arabic-level1/theory-reference.html';
function hznTheoryDecrypt(string $cipher,string $key):string {
 if(strlen($key)!==32||strlen($cipher)<29)hznUiFail('THEORY_CIPHER');
 $packed=openssl_decrypt(substr($cipher,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($cipher,0,12),substr($cipher,-16),HZN_THEORY_AAD);
 if($packed===false)hznUiFail('THEORY_TAG');
 $plain=gzdecode($packed,16777216);if($plain===false||strlen($plain)>16777216)hznUiFail('THEORY_SIZE');return $plain;
}
function hznTheoryEncrypt(string $plain,string $key):string {
 if(strlen($key)!==32||strlen($plain)<1||strlen($plain)>16777216)hznUiFail('THEORY_SIZE');
 $iv=random_bytes(12);$tag='';$packed=gzencode($plain,9);if($packed===false)hznUiFail('THEORY_COMPRESSION');
 $cipher=openssl_encrypt($packed,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,HZN_THEORY_AAD,16);if($cipher===false)hznUiFail('THEORY_ENCRYPTION');
 $out=$iv.$cipher.$tag;if(hznTheoryDecrypt($out,$key)!==$plain)hznUiFail('THEORY_ROUNDTRIP');return $out;
}
function hznTheorySource(string $repo,array $entry,string $path):string {
 if(array_keys($entry)!==['path','bytes','sha256']||$entry['path']!==$path||!is_int($entry['bytes'])||$entry['bytes']<1||$entry['bytes']>16777216||!hznUiSha($entry['sha256']))hznUiFail('THEORY_MANIFEST');
 $raw=hznUiRead(hznUiPath($repo,$path),null,16777216);if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hznUiHash($raw)))hznUiFail('THEORY_SOURCE');return $raw;
}
function hznTheoryPrivateSource(string $web,array $entry):string {
 $relative='.horizons-theory-incoming-20261008-r3/reference.html';
 if(array_keys($entry)!==['path','bytes','sha256']||$entry['path']!==$relative||!is_int($entry['bytes'])||$entry['bytes']<1||$entry['bytes']>16777216||!hznUiSha($entry['sha256']))hznUiFail('THEORY_MANIFEST');
 $dir=hznUiPath(dirname($web),'.horizons-theory-incoming-20261008-r3');
 clearstatcache(true,$dir);
 if(!is_dir($dir)||(fileperms($dir)&0777)!==0700)hznUiFail('THEORY_PRIVATE_DIRECTORY');
 $raw=hznUiRead(hznUiPath($dir,'reference.html'),0600,16777216);
 if(strlen($raw)!==$entry['bytes']||!hash_equals($entry['sha256'],hznUiHash($raw)))hznUiFail('THEORY_SOURCE');
 return $raw;
}
function hznTheoryPublicDir(string $web):string {
 $dir=hznUiPath($web,'reference');if(file_exists($dir)){if(!is_dir($dir)||(fileperms($dir)&0777)!==0755)hznUiFail('THEORY_DIRECTORY');}
 else if(!mkdir($dir,0755)||!chmod($dir,0755))hznUiFail('THEORY_DIRECTORY');return $dir;
}
function hznTheoryImmutable(string $path,string $raw):void {
 if(file_exists($path))hznUiMatch($path,hznUiHash($raw),0644);else hznUiWrite($path,$raw,0644);
}
function hznTheoryRetirePrevious(string $web):void {
 // Only these two exact publisher-owned public references may be replaced.
 // Unknown files are refused, and each original gets a verified private copy.
 $owned=['horizons-theory-20261008-r1.html'=>'010007e5394527b39fc3217b1b133484e167f0fdab62e62dde114350223afc3b',
         'horizons-theory-20261008-r2.html'=>'d7147fd987603e886619f52d4f6382b6381f7fd6601ecad8c5a29b6637417816'];
 $redirect='<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>HORIZONS</title></head><body><a href="/reference/horizons-theory-demo-20261008-r3.html">HORIZONS</a><script>location.replace("/reference/horizons-theory-demo-20261008-r3.html"+location.search);</script></body></html>';
 $replacement=hznUiHash($redirect);$todo=[];$backup=hznUiPath(dirname($web),'.horizons-theory-reference');
 foreach($owned as $name=>$sha){
  $path=hznUiPath($web,'reference/'.$name);if(!file_exists($path))continue;
  $raw=hznUiRead($path,0644,16777216);$actual=hznUiHash($raw);
  if(hash_equals($replacement,$actual)){
   hznUiMatch(hznUiPath($backup,$name),$sha,0600);continue;
  }
  if(!hash_equals($sha,$actual))hznUiFail('THEORY_OLD_REFERENCE_CHANGED');
  $todo[]=[$name,$path,$sha,$raw];
 }
 if(!$todo)return;
 hznUiMkdir($backup);
 foreach($todo as [$name,$path,$sha,$raw]){
  $saved=hznUiPath($backup,$name);if(file_exists($saved))hznUiMatch($saved,$sha,0600);else hznUiWrite($saved,$raw,0600);
 }
 foreach($todo as [$name,$path,$sha,$raw])hznUiWrite($path,$redirect,0644,$sha);
}
function hznTheoryPublish(string $repo,string $web,array $m,string $key):array {
 $languages=explode(' ','en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja');
 if(($m['schema']??null)!==2||($m['edition']??null)!=='expanded-reference-20261008-r3'||($m['languages']??null)!==$languages||($m['review_passes']??null)!==2||($m['sources']['guard']['path']??null)!=='scripts/theory-reference-guard.php')hznUiFail('THEORY_RELEASE');
 $prefix='release-assets/theory-reference-20261008-r1/';
 $full=hznTheoryPrivateSource($web,$m['sources']['full']??[]);
 $demo=hznTheorySource($repo,$m['sources']['demo']??[],$prefix.'demo-reference.html');
 $template=hznTheorySource($repo,$m['sources']['loader']??[],'src/theory-reference/paid-reader-loader.html');
 hznTheorySource($repo,$m['sources']['guard']??[],'scripts/theory-reference-guard.php');
 if(substr_count($template,'__HZN_REFERENCE_METADATA__')!==1||str_contains($demo,'"id":"pronouns"')||str_contains($demo,'"id":"phonics"')||!str_contains($demo,'"mode":"demo"')||!str_contains($full,'"mode":"full"'))hznUiFail('THEORY_SCOPE');
 $dir=hznTheoryPublicDir($web);$cipherPath=hznUiPath($dir,'horizons-theory-paid-20261008-r3.html.hzn');
 // Reuse an authenticated existing immutable cipher rather than creating a new
 // IV and accidentally replacing a previous partial run's encrypted artifact.
 if(file_exists($cipherPath)){$cipher=hznUiRead($cipherPath,0644,16777216);if(hznTheoryDecrypt($cipher,$key)!==$full)hznUiFail('THEORY_EXISTING');}
 else {$cipher=hznTheoryEncrypt($full,$key);hznTheoryImmutable($cipherPath,$cipher);}
 $meta=['url'=>'/reference/horizons-theory-paid-20261008-r3.html.hzn','bytes'=>strlen($cipher),'sha256'=>hznUiHash($cipher),'decoded_bytes'=>strlen($full)];
 $loader=str_replace('__HZN_REFERENCE_METADATA__',hznUiJson($meta),$template);
 hznTheoryImmutable(hznUiPath($dir,'horizons-theory-demo-20261008-r3.html'),$demo);
 hznTheoryImmutable(hznUiPath($dir,'horizons-theory-paid-20261008-r3.html'),$loader);
 hznTheoryImmutable(hznUiPath($dir,'horizons-theory-paid-20261008-r3.json'),hznUiJson($meta)."\n");
 hznTheoryRetirePrevious($web);
 return ['demo_sha256'=>hznUiHash($demo),'cipher_sha256'=>hznUiHash($cipher),'loader_sha256'=>hznUiHash($loader)];
}
