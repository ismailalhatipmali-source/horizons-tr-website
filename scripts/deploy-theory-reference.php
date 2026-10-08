<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/native-ui-state.php';
$lock=null;
try {
 if(count($argv)!==3 || $argv[2]!=='--publish') hznUiFail('REFERENCE_ARGUMENTS');
 $web=hznUiRoot($argv[1]);$repo=hznUiRoot(dirname(__DIR__));
 if($web!=='/home2/horizonstr/public_html'||$repo!=='/home2/horizonstr/repositories/horizons-tr-website-live')hznUiFail('REFERENCE_ROOT');
 if(trim(hznUiRead($repo.'/.git/HEAD',null,256))!=='ref: refs/heads/main')hznUiFail('REFERENCE_BRANCH');
 hznUiRelease($repo);
 $m=json_decode(hznUiRead($repo.'/release-assets/theory-reference-20261008-r1/manifest.json',null,4096),true,32,JSON_THROW_ON_ERROR);
 if(($m['schema']??null)!==1 || ($m['path']??null)!=='reference/horizons-theory-20261008-r2.html'||!hznUiSha($m['sha256']??null))hznUiFail('REFERENCE_MANIFEST');
 $raw=hznUiRead($repo.'/release-assets/theory-reference-20261008-r1/reference.html',null,16777216);
 if(strlen($raw)!==$m['bytes']||!hash_equals($m['sha256'],hznUiHash($raw)))hznUiFail('REFERENCE_SOURCE');
 $candidate=hznUiPath(dirname($web),'.horizons-production-chain.lock');
 if(file_exists($candidate)||!mkdir($candidate,0700))hznUiFail('REFERENCE_BUSY');$lock=$candidate;
 $dir=hznUiPath($web,'reference');
 if(file_exists($dir)){if(!is_dir($dir)||(fileperms($dir)&0777)!==0755)hznUiFail('REFERENCE_DIRECTORY');}
 else if(!mkdir($dir,0755)||!chmod($dir,0755))hznUiFail('REFERENCE_DIRECTORY');
 $target=hznUiPath($web,$m['path']);
 if(file_exists($target))hznUiMatch($target,$m['sha256'],0644);
 else hznUiWrite($target,$raw,0644);
 hznUiMatch($target,$m['sha256'],0644);
 echo "REFERENCE READY: immutable theory file verified; no learner or licensed curriculum changes.\n";
}catch(Throwable $error){$code=$error instanceof RuntimeException&&preg_match('/^[A-Z0-9_]+$/D',$error->getMessage())?$error->getMessage():'UI_REFERENCE_FAILED';fwrite(STDERR,'STOP: '.$code."\n");$failed=true;}
finally {if($lock!==null&&!rmdir($lock)){$failed=true;fwrite(STDERR,"STOP: UI_REFERENCE_LOCK\n");}}
exit(isset($failed)?1:0);
