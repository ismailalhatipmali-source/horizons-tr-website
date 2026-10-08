<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
require_once __DIR__.'/native-ui-plan.php';
$lock=null;$key=null;
try {
 if(count($argv)!==3 || $argv[2]!=='--publish')hznUiFail('REFERENCE_ARGUMENTS');
 $web=hznUiRoot($argv[1]);$repo=hznUiRoot(dirname(__DIR__));
 if($web!=='/home2/horizonstr/public_html'||$repo!=='/home2/horizonstr/repositories/horizons-tr-website-live')hznUiFail('REFERENCE_ROOT');
 if(trim(hznUiRead($repo.'/.git/HEAD',null,256))!=='ref: refs/heads/main')hznUiFail('REFERENCE_BRANCH');
 hznUiRelease($repo);
 $m=json_decode(hznUiRead($repo.'/release-assets/theory-reference-20261008-r1/manifest.json',null,16384),true,32,JSON_THROW_ON_ERROR);
 $guard=$m['sources']['guard']??[];
 if(($m['schema']??null)!==2||($guard['path']??null)!=='scripts/theory-reference-guard.php'||!hznUiSha($guard['sha256']??null))hznUiFail('REFERENCE_MANIFEST');
 $guardPath=hznUiPath($repo,'scripts/theory-reference-guard.php');$guardRaw=hznUiRead($guardPath,null,65536);
 if(strlen($guardRaw)!==($guard['bytes']??null)||!hash_equals($guard['sha256'],hznUiHash($guardRaw)))hznUiFail('REFERENCE_GUARD');
 require_once $guardPath;
 $candidate=hznUiPath(dirname($web),'.horizons-production-chain.lock');
 if(file_exists($candidate)||!mkdir($candidate,0700))hznUiFail('REFERENCE_BUSY');$lock=$candidate;
 hznUiChain($web);$key=hznUiKey($web);
 $result=hznTheoryPublish($repo,$web,$m,$key);
 hznUiChain($web);
 echo "REFERENCE READY: restricted demo and licensed encrypted reference verified; learner state preserved.\n";
}catch(Throwable $error){$code=$error instanceof RuntimeException&&preg_match('/^[A-Z0-9_]+$/D',$error->getMessage())?$error->getMessage():'UI_REFERENCE_FAILED';fwrite(STDERR,'STOP: '.$code."\n");$failed=true;}
finally {
 if(is_string($key)&&function_exists('sodium_memzero'))sodium_memzero($key);
 if($lock!==null&&!rmdir($lock)){$failed=true;fwrite(STDERR,"STOP: UI_REFERENCE_LOCK\n");}
}
exit(isset($failed)?1:0);
