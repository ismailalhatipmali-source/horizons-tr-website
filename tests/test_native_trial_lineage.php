<?php
declare(strict_types=1);
// Exercise the real CM and trial State validators on synthetic public shells.
// Historical release loaders and the unrelated B4/focus State validators are
// replaced by fixture contracts; no host, licence or educational content is used.
define('HZN_UI_FIXTURE_ONLY', true);
require __DIR__.'/test_native_publication.php';
$f=fixture(); $repo=$f['home'].'/lineage-repo'; mkdir($repo,0700); mkdir($repo.'/scripts',0700);
foreach(['comprehensive-meaning-preservation.php'=>'hznCMRelease','trial-pause-preservation.php'=>'hznTrialPauseRelease'] as $file=>$loader){
    $source=file_get_contents($ROOT.'/scripts/'.$file);
    check(substr_count($source,'function '.$loader.'(')===1);
    $source=str_replace('function '.$loader.'(','function '.$loader.'NotCalled(',$source);
    $key=$loader==='hznCMRelease'?'cmRelease':'trialRelease';
    $source.="\nfunction $loader(string \$repo):array{return \$GLOBALS['$key'];}\n";
    put($repo.'/scripts/'.$file,$source);
}
put($repo.'/scripts/native-ui-state.php','<?php require_once '.var_export($ROOT.'/scripts/native-ui-state.php',true).';');
put($repo.'/scripts/blending4-preservation.php', <<<'PHP'
<?php
const HZN_B4_SHARED=['learn/asset-manifest.json','learn/sw.js','learn/content/1.4.1/workbook.js.hzn'];
const HZN_FOCUS_PATHS=['try/workbook.js','try/demo-asset-manifest.json','try/sw.js','learn/content/1.4.1/workbook.js.hzn','learn/asset-manifest.json','learn/sw.js'];
const HZN_FOCUS_PUBLIC=['try/workbook.js','try/demo-asset-manifest.json','try/sw.js'];
function hznFocusState(string $web):?array{return null;}
function hznB4State(string $web):?array{return null;}
function hznFocusPreviousPath(string $web,string $p,?array $focus):string{return $web.'/'.$p;}
function hznB4PreviousPath(string $web,string $p,?array $b4,?array $focus=null):string{return $web.'/'.$p;}
PHP
);
require $repo.'/scripts/comprehensive-meaning-preservation.php';
$old=['try/index.html'=>'demo-shell','try/workbook.js'=>'old-demo','try/sw.js'=>"const CACHE='hzn-public-demo-'+VERSION+'-demo-experience-20261004-r1';\n".'/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience)-\\d{8}-r\\d+)?$/',
    'learn/index.html'=>'old-eligible-trial-shell','try/demo-asset-manifest.json'=>'','try/demo-experience.css'=>'demo-css',
    'learn/sw.js'=>"const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';",
    'learn/asset-manifest.json'=>'','learn/content/1.4.1/workbook.js.hzn'=>'old-encrypted-fixture'];
$entry=fn(string $b,bool $paid)=>array_merge(['sha256'=>hznUiHash($b),'bytes'=>strlen($b)],$paid?['encoding'=>'gzip','decoded_bytes'=>123]:[]);
$old['try/demo-asset-manifest.json']=hznUiJson(['files'=>['workbook.js'=>$entry($old['try/workbook.js'],false),'other'=>['sha256'=>hznUiHash('unchanged')]]]);
$old['learn/asset-manifest.json']=hznUiJson(['files'=>['workbook.js'=>$entry($old['learn/content/1.4.1/workbook.js.hzn'],true),'other'=>['sha256'=>hznUiHash('unchanged')]]]);
$current=$old; $current['try/workbook.js']='new-demo'; $current['learn/content/1.4.1/workbook.js.hzn']='new-encrypted-fixture';
foreach(['try'=>false,'learn'=>true] as $e=>$paid){$mp=$e.($paid?'/asset-manifest.json':'/demo-asset-manifest.json');$app=$paid?'learn/content/1.4.1/workbook.js.hzn':'try/workbook.js';$m=json_decode($old[$mp],true);$m['files']['workbook.js']=$entry($current[$app],$paid);$current[$mp]=hznUiJson($m);$current[$e.'/sw.js']=hznCMWorker($old[$e.'/sw.js'],$paid);}
$beforeHashes=array_map('hznUiHash',$old); $afterHashes=array_map('hznUiHash',$current);
$inherited=[];
foreach(HZN_COMPREHENSIVE_MEANING_RECEIPTS as $p){
    $r=$p==='.horizons-demo-experience/receipt.json'?['patch'=>'demo-experience-20261004-r1','manifest_sha256'=>HZN_COMPREHENSIVE_MEANING_DEMO_MANIFEST_SHA256,'hashes'=>$beforeHashes]:
        ($p==='.horizons-workbook-responsive/receipt.json'?['patch'=>'workbook-responsive-20261004-r3','plain_after_sha256'=>hznUiHash('old-plain'),'hashes'=>['asset-manifest.json'=>$beforeHashes['learn/asset-manifest.json'],'content/1.4.1/workbook.js.hzn'=>$beforeHashes['learn/content/1.4.1/workbook.js.hzn']]]:['fixture'=>true]);
    $raw=hznUiJson($r); put($f['home'].'/'.$p,$raw,0600);$inherited[$p]=hznUiHash($raw);
}
$cmRelease=['input_sources'=>[],'files'=>[]];
foreach(array_slice(HZN_COMPREHENSIVE_MEANING_PATHS,0,7) as $p)$cmRelease['files'][$p]=['before'=>$beforeHashes[$p],'sha256'=>$afterHashes[$p],'bytes'=>strlen($current[$p])];
$receipt=['schema'=>1,'patch'=>HZN_COMPREHENSIVE_MEANING_RELEASE,'manifest_sha256'=>HZN_COMPREHENSIVE_MEANING_MANIFEST_SHA256,'sources'=>[],
    'hashes'=>$afterHashes,'before_hashes'=>$beforeHashes,'before_modes'=>array_fill_keys(HZN_COMPREHENSIVE_MEANING_PATHS,0644),'inherited_receipts'=>$inherited,
    'worker_suffix'=>HZN_COMPREHENSIVE_MEANING_WORKER_SUFFIX,'plain_before_sha256'=>hznUiHash('old-plain'),'plain_after_sha256'=>hznUiHash('new-plain')];
put($f['home'].'/.horizons-comprehensive-meaning/receipt.json',hznUiJson($receipt),0600);
foreach($old as $p=>$b)put($f['home'].'/.horizons-comprehensive-meaning/baseline/'.$p,$b,0600);
foreach($current as $p=>$b)put($f['web'].'/'.$p,$b);
$trialDir=$f['home'].'/.horizons-trial-pause'; unlink($trialDir.'/receipt.json');
run('pre_trial_historical_chain_remains_valid',function()use($f,$trialDir){rmdir($trialDir);check(hznCMState($f['web'])!==null);mkdir($trialDir,0700);});
$trialRelease=['files'=>[]]; $trial=['schema'=>1,'release'=>HZN_TRIAL_PAUSE_RELEASE,'manifest_sha256'=>HZN_TRIAL_PAUSE_MANIFEST_SHA256,'before_hashes'=>[],'hashes'=>[],
    'focus_receipt_sha256'=>hash_file('sha256',$f['home'].'/'.HZN_UI_RECEIPTS[0])];
foreach(HZN_TRIAL_PAUSE_PATHS as $p){$oldTrial=$current[$p]??'old-locales';$now='trial-paused-'.$p;put($trialDir.'/baseline/'.$p,$oldTrial,0600);put($f['web'].'/'.$p,$now);
    $trialRelease['files'][$p]=['before'=>hznUiHash($oldTrial),'sha256'=>hznUiHash($now)];$trial['before_hashes'][$p]=hznUiHash($oldTrial);$trial['hashes'][$p]=hznUiHash($now);}
$trialRaw=hznUiJson($trial); put($trialDir.'/receipt.json',$trialRaw,0600);
// CM does not use the trial worker directly: production B4/focus resolves that
// worker to earlier validated backups. The fixture resolver models this path.
$b4Source=file_get_contents($repo.'/scripts/blending4-preservation.php');
// Functions already loaded cannot be replaced. Restore only the fixture worker
// and update trial's worker contract to match the CM worker for this isolated test.
put($f['web'].'/learn/sw.js',$current['learn/sw.js']);
$trialRelease['files']['learn/sw.js']['sha256']=hznUiHash($current['learn/sw.js']);$trial['hashes']['learn/sw.js']=hznUiHash($current['learn/sw.js']);
$trialRaw=hznUiJson($trial);put($trialDir.'/receipt.json',$trialRaw,0600);
run('trial_entry_uses_validated_historical_baseline_without_writes',function()use($f){$before=treeHash($f['home']);check(hznCMState($f['web'])!==null);check(treeHash($f['home'])===$before);});
run('current_trial_entry_tamper_rejected',function()use($f){$p=$f['web'].'/learn/index.html';$raw=file_get_contents($p);put($p,'foreign-edit');rejects(fn()=>hznCMState($f['web']),'TRIAL_PAUSE_PUBLIC_CHANGED');put($p,$raw);});
run('trial_baseline_tamper_rejected',function()use($f,$trialDir){$p=$trialDir.'/baseline/learn/index.html';$raw=file_get_contents($p);put($p,'foreign-baseline',0600);rejects(fn()=>hznCMState($f['web']),'TRIAL_PAUSE_PUBLIC_CHANGED');put($p,$raw,0600);});
run('trial_baseline_mode_rejected',function()use($f,$trialDir){$p=$trialDir.'/baseline/learn/index.html';chmod($p,0644);clearstatcache();rejects(fn()=>hznCMState($f['web']),'TRIAL_PAUSE_PUBLIC_CHANGED');chmod($p,0600);clearstatcache();});
run('missing_trial_receipt_rejected',function()use($f,$trialDir,$trialRaw){unlink($trialDir.'/receipt.json');rejects(fn()=>hznCMState($f['web']),'TRIAL_PAUSE_RECEIPT_REQUIRED');put($trialDir.'/receipt.json',$trialRaw,0600);});
run('trial_baseline_symlink_rejected',function()use($f,$trialDir){$p=$trialDir.'/baseline/learn/index.html';rename($p,$p.'.saved');symlink($p.'.saved',$p);rejects(fn()=>hznCMState($f['web']),'TRIAL_PAUSE_SYMLINK_REJECTED');unlink($p);rename($p.'.saved',$p);});
run('unrelated_demo_change_still_rejected',function()use($f){$p=$f['web'].'/try/index.html';$raw=file_get_contents($p);put($p,'foreign-demo');rejects(fn()=>hznCMState($f['web']),'COMPREHENSIVE_PUBLIC_CHANGED');put($p,$raw);});
run('original_comprehensive_baseline_still_checked',function()use($f){$p=$f['home'].'/.horizons-comprehensive-meaning/baseline/learn/index.html';$raw=file_get_contents($p);put($p,'foreign-old-baseline',0600);rejects(fn()=>hznCMState($f['web']),'COMPREHENSIVE_BASELINE_CHANGED');put($p,$raw,0600);});
foreach($fixtures as $d){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $x){$x->isDir()&&!$x->isLink()?rmdir($x->getPathname()):unlink($x->getPathname());}rmdir($d);}
$passed=count(array_filter($results,fn($r)=>$r['passed']));echo 'RESULT '.$passed.'/'.count($results)." passed\n";exit($passed===count($results)?0:1);
