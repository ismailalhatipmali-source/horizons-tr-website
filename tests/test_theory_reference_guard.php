<?php
declare(strict_types=1);
require dirname(__DIR__).'/scripts/native-ui-publication.php';
require dirname(__DIR__).'/scripts/theory-reference-guard.php';
function insist(bool $ok):void{if(!$ok)throw new RuntimeException('TEST_FAILED');}
function reject(callable $fn,string $code):void{try{$fn();}catch(RuntimeException $e){insist(str_contains($e->getMessage(),$code));return;}throw new RuntimeException('TEST_EXPECTED_REJECTION');}
$key=random_bytes(32);$plain='<html><body>Original synthetic sample — ثَ</body></html>';
$c=hznTheoryEncrypt($plain,$key);insist(hznTheoryDecrypt($c,$key)===$plain);
reject(fn()=>hznTheoryDecrypt($c,random_bytes(32)),'THEORY_TAG');
$damaged=$c;$damaged[15]=chr(ord($damaged[15])^1);reject(fn()=>hznTheoryDecrypt($damaged,$key),'THEORY_TAG');
reject(fn()=>hznUiDecrypt($c,$key),'AUTH');
reject(fn()=>hznTheoryEncrypt('', $key),'THEORY_SIZE');
echo "PASS: theory AES-GCM roundtrip, tag, key, AAD separation and size\n";
if(DIRECTORY_SEPARATOR==='\\'){echo "SKIP: POSIX filesystem fixtures require Linux CI\n";exit(0);}
$home=sys_get_temp_dir().'/hzn-theory-'.bin2hex(random_bytes(8));mkdir($home,0700);$repo=$home.'/repo';$web=$home.'/web';mkdir($repo,0700);mkdir($web,0755);
function fixtureSource(string $repo,string $path,string $raw):array{if(!is_dir(dirname($repo.'/'.$path)))mkdir(dirname($repo.'/'.$path),0700,true);file_put_contents($repo.'/'.$path,$raw);chmod($repo.'/'.$path,0644);return ['path'=>$path,'bytes'=>strlen($raw),'sha256'=>hznUiHash($raw)];}
try{
 $prefix='release-assets/theory-reference-20261008-r1/';
 $m=['schema'=>2,'edition'=>'expanded-reference-20261008-r3','languages'=>explode(' ','en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'),'review_passes'=>2,'sources'=>[
 'full'=>fixtureSource($repo,$prefix.'reference.html',$plain.'"mode":"full"'),
 'demo'=>fixtureSource($repo,$prefix.'demo-reference.html','<html>Restricted synthetic demo "mode":"demo"</html>'),
 'loader'=>fixtureSource($repo,'src/theory-reference/paid-reader-loader.html','<script>const M=__HZN_REFERENCE_METADATA__;</script>'),
 'guard'=>fixtureSource($repo,'scripts/theory-reference-guard.php','Synthetic guard pin')]];
 $sentinel=$web.'/learner-sentinel';file_put_contents($sentinel,'UNCHANGED');
 $first=hznTheoryPublish($repo,$web,$m,$key);$second=hznTheoryPublish($repo,$web,$m,$key);insist($first===$second);insist(file_get_contents($sentinel)==='UNCHANGED');
 $path=$web.'/reference/horizons-theory-paid-20261008-r3.html.hzn';$cipher=file_get_contents($path);insist(!str_contains($cipher,$plain));insist(hznTheoryDecrypt($cipher,$key)===$plain.'"mode":"full"');
 $bad=$m;$bad['languages']=array_slice($bad['languages'],0,31);reject(fn()=>hznTheoryPublish($repo,$web,$bad,$key),'THEORY_RELEASE');
 $bad=$m;$bad['sources']['demo']['path']='../outside.html';reject(fn()=>hznTheoryPublish($repo,$web,$bad,$key),'THEORY_MANIFEST');
 file_put_contents($path,$cipher.'x');reject(fn()=>hznTheoryPublish($repo,$web,$m,$key),'THEORY_TAG');
 $old=file_get_contents(dirname(__DIR__).'/release-assets/theory-reference-20261008-r1/previous-r2.html');
 insist(hznUiHash($old)==='d7147fd987603e886619f52d4f6382b6381f7fd6601ecad8c5a29b6637417816');
 $oldPath=$web.'/reference/horizons-theory-20261008-r2.html';file_put_contents($oldPath,$old);chmod($oldPath,0644);
 hznTheoryRetirePrevious($web);insist(!str_contains(file_get_contents($oldPath),'window.HZN'));insist(file_get_contents($home.'/.horizons-theory-reference/horizons-theory-20261008-r2.html')===$old);hznTheoryRetirePrevious($web);
 file_put_contents($web.'/reference/horizons-theory-20261008-r1.html','FOREIGN FILE');chmod($web.'/reference/horizons-theory-20261008-r1.html',0644);
 reject(fn()=>hznTheoryRetirePrevious($web),'THEORY_OLD_REFERENCE_CHANGED');insist(file_get_contents($web.'/reference/horizons-theory-20261008-r1.html')==='FOREIGN FILE');
 echo "PASS: exact-owned old reference retirement, verified private backup, restart and foreign-file refusal\n";
 echo "PASS: immutable restricted demo, protected full reader, idempotency, fixed paths, corruption refusal, learner sentinel\n";
}finally{
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($home,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$p=$f->getPathname();insist(str_starts_with($p,$home.'/'));$f->isDir()?rmdir($p):unlink($p);}rmdir($home);
}

