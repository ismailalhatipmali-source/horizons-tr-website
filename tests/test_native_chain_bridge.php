<?php
declare(strict_types=1);
/* Tests the actual modified predecessor State functions, worker transformation and
 * demo patch against generated predecessor receipts. Only the historical Release
 * source loaders are substituted, because private historical deployments are not
 * test inputs. The new UI release verifier is real and unmodified throughout.
 */
define('HZN_UI_FIXTURE_ONLY',true);
require __DIR__.'/test_native_publication.php';
$f=fixture(); $base=$f['home'].'/contract-repo';mkdir($base,0700);mkdir($base.'/scripts',0700);
foreach(['workbook-focus-preservation.php'=>'hznFocusRelease','trial-pause-preservation.php'=>'hznTrialPauseRelease'] as $file=>$loader){
    $source=file_get_contents($ROOT.'/scripts/'.$file);
    check(substr_count($source,'function '.$loader.'(')===1);
    $source=str_replace('function '.$loader.'(','function '.$loader.'NotCalled(',$source);
    $key=$loader==='hznFocusRelease'?'focusRelease':'trialRelease';
    $source.="\nfunction $loader(string \$repo):array{return \$GLOBALS['$key'];}\n";
    put($base.'/scripts/'.$file,$source);
}
put($base.'/scripts/native-ui-state.php','<?php require_once '.var_export($ROOT.'/scripts/native-ui-state.php',true).';');
require $base.'/scripts/workbook-focus-preservation.php';
require $base.'/scripts/trial-pause-preservation.php';
// Real demo predecessor replacement hook, without educational content.
$oldDemo = <<<'JS'
(function(){
function buttonStatus(section){return section==='blending4'?text('comingSoon'):['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}
const row=`${section==='blending4'?'is-coming-soon':['alphabet','catalog'].includes(section)?'is-free':'is-locked'}`;
panelMarkup(text(preview),preview==='blending4');
init();

})();
JS;
$hook="/*WORKBOOK_FOCUS_BEGIN*/\nglobalThis.hznFocusShell=Object.freeze({});\n/*WORKBOOK_FOCUS_END*/\n";
put($base.'/hook.js',$hook);
$focusRelease=['compiled_hook'=>['source'=>'hook.js']];
$newDemo=hznFocusPatch($oldDemo,$base,$focusRelease,false);
put($f['web'].'/try/workbook.js',$newDemo);
$demoManifest=json_decode(file_get_contents($f['web'].'/try/demo-asset-manifest.json'),true);
$demoManifest['files']['workbook.js']['sha256']=hznUiHash($newDemo);$demoManifest['files']['workbook.js']['bytes']=strlen($newDemo);
put($f['web'].'/try/demo-asset-manifest.json',hznUiJson($demoManifest)."\n");
$f['snapshot']=hznUiSnapshot($f['web']);$f['demo']=$newDemo;
$focusCurrent=array_map(fn($x)=>$x['bytes'],$f['snapshot']);
$focusCurrent['learn/sw.js']=str_replace('-trial-pause-20261005-r1','',$focusCurrent['learn/sw.js']);
$oldFocus=$focusCurrent;$oldFocus['try/workbook.js']=$oldDemo;
$oldFocus['learn/content/1.4.1/workbook.js.hzn']='SYNTHETIC-B4-CIPHER';
foreach(['try'=>false,'learn'=>true] as $e=>$paid){
    $mp=$e.($paid?'/asset-manifest.json':'/demo-asset-manifest.json');$a=$paid?'learn/content/1.4.1/workbook.js.hzn':'try/workbook.js';
    $m=json_decode($oldFocus[$mp],true);$m['files']['workbook.js']['sha256']=hznUiHash($oldFocus[$a]);$m['files']['workbook.js']['bytes']=strlen($oldFocus[$a]);
    $oldFocus[$mp]=hznUiJson($m)."\n";
}
$oldFocus['try/sw.js']=str_replace(['-workbook-focus-20261005-r1','|workbook-focus'],['-comprehensive-meaning-20261004-r1',''],$oldFocus['try/sw.js']);
$oldFocus['learn/sw.js']=str_replace('-workbook-focus-20261005-r1','',$oldFocus['learn/sw.js']);
foreach(HZN_FOCUS_PATHS as $p)put($f['home'].'/.horizons-workbook-focus/baseline/'.$p,$oldFocus[$p],0600);
$b4=['release'=>'blending4-20261004-r1','hashes'=>array_map('hznUiHash',$oldFocus),'plain_after_sha256'=>hznUiHash('synthetic-before-focus')];
$cm=['patch'=>'comprehensive-meaning-20261004-r1','hashes'=>array_map('hznUiHash',$oldFocus)];
$inherited=[];
foreach(['.horizons-blending4/receipt.json'=>$b4,'.horizons-comprehensive-meaning/receipt.json'=>$cm] as $p=>$v){$raw=hznUiJson($v)."\n";put($f['home'].'/'.$p,$raw,0600);$inherited[$p]=hznUiHash($raw);}
$focusRelease=['manifest_sha256'=>hznUiHash('fixture-focus-manifest'),'sources'=>[],'compiled_hook'=>['source'=>'hook.js'],'files'=>[]];
foreach(HZN_FOCUS_PUBLIC as $p)$focusRelease['files'][$p]=['before'=>hznUiHash($oldFocus[$p]),'sha256'=>hznUiHash($focusCurrent[$p])];
$focus=['schema'=>1,'release'=>HZN_FOCUS_RELEASE,'manifest_sha256'=>$focusRelease['manifest_sha256'],'sources'=>[],
    'hashes'=>[],'before_hashes'=>[],'before_modes'=>[],'inherited_receipts'=>$inherited,
    'plain_before_sha256'=>$b4['plain_after_sha256'],'plain_after_sha256'=>hznUiHash($f['plain'])];
foreach(HZN_FOCUS_PATHS as $p){$focus['hashes'][$p]=hznUiHash($focusCurrent[$p]);$focus['before_hashes'][$p]=hznUiHash($oldFocus[$p]);$focus['before_modes'][$p]=0644;}
$focusRaw=hznUiJson($focus)."\n";put($f['home'].'/'.HZN_UI_RECEIPTS[0],$focusRaw,0600);
$trialRelease=['files'=>[]];$trial=['schema'=>1,'release'=>HZN_TRIAL_PAUSE_RELEASE,'manifest_sha256'=>HZN_TRIAL_PAUSE_MANIFEST_SHA256,
    'before_hashes'=>[],'hashes'=>[],'focus_receipt_sha256'=>hznUiHash($focusRaw)];
foreach(HZN_TRIAL_PAUSE_PATHS as $p){$old=$p==='learn/sw.js'?$focusCurrent[$p]:'SYNTHETIC-OLD-TRIAL-'.$p;$now=file_get_contents($f['web'].'/'.$p);
    put($f['home'].'/.horizons-trial-pause/baseline/'.$p,$old,0600);$trialRelease['files'][$p]=['before'=>hznUiHash($old),'sha256'=>hznUiHash($now)];
    $trial['before_hashes'][$p]=hznUiHash($old);$trial['hashes'][$p]=hznUiHash($now);
}
put($f['home'].'/'.HZN_UI_RECEIPTS[1],hznUiJson($trial)."\n",0600);
$f['focus']=$focus;$f['trial']=$trial;$p=plan($f);
run('legacy_state_valid_before_native_update',function()use($f){check(hznFocusState($f['web'])!==null);check(hznTrialPauseState($f['web'])!==null);});
run('legacy_state_valid_after_native_update',function()use($f,$p){publish($f,$p);check(hznFocusState($f['web'])!==null);check(hznTrialPauseState($f['web'])!==null);sentinels($f);});
run('legacy_validators_detect_current_native_tamper',function()use($f,$p){put($f['web'].'/try/sw.js','unexpected');rejects(fn()=>hznFocusState($f['web']),'CONCURRENT_CHANGE');rejects(fn()=>hznTrialPauseState($f['web']),'CONCURRENT_CHANGE');put($f['web'].'/try/sw.js',$p['after']['try/sw.js']);});
run('legacy_state_valid_after_native_rollback',function()use($f){hznUiRollback($f['web']);check(hznFocusState($f['web'])!==null);check(hznTrialPauseState($f['web'])!==null);unchanged($f);});
$report=['kind'=>'predecessor-state-bridge-contract','historical_release_loaders'=>'synthetic','native_release_verifier'=>'real-unmodified','php'=>PHP_VERSION,
    'total'=>count($results),'passed'=>count(array_filter($results,fn($r)=>$r['passed'])),'tests'=>$results,'production_host_tested'=>false];
file_put_contents($ROOT.'/artifacts/native-chain-bridge-results.json',json_encode($report,JSON_PRETTY_PRINT)."\n");
foreach($fixtures as $d){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $x){$x->isDir()&&!$x->isLink()?rmdir($x->getPathname()):unlink($x->getPathname());}rmdir($d);}
echo 'RESULT '.$report['passed'].'/'.$report['total']." passed\n";exit($report['passed']===$report['total']?0:1);
