<?php
declare(strict_types=1);
/* Synthetic filesystem + AES-GCM integration tests for the real publisher code.
 * These are not authenticated full-curriculum, cPanel or browser/offline tests.
 * All mutations are in fresh temporary directories; no network or real keys.
 */
require_once dirname(__DIR__) . '/scripts/native-ui-plan.php';
$ROOT = dirname(__DIR__); $RELEASE = hznUiRelease($ROOT); $results = []; $fixtures = [];
function check(bool $condition, string $label = 'assertion'): void { if (!$condition) throw new Exception($label); }
function rejects(callable $operation, string $contains): void {
    try { $operation(); } catch (Throwable $e) { check(str_contains($e->getMessage(), $contains), $contains . ': ' . $e->getMessage()); return; }
    throw new Exception('Expected rejection ' . $contains);
}
function put(string $path, string $raw, int $mode = 0644): void {
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
    file_put_contents($path, $raw); chmod($path, $mode); clearstatcache(true, $path);
}
function fixture(): array {
    global $fixtures, $RELEASE;
    $home = sys_get_temp_dir() . '/hzn-ui-' . bin2hex(random_bytes(8)); mkdir($home, 0700); $fixtures[] = $home;
    $web = $home . '/public_html'; mkdir($web, 0755); $key = random_bytes(32);
    $plain = "// SYNTHETIC paid sample only — بَ بُ بِ\n/*WORKBOOK_FOCUS_BEGIN*/\nglobalThis.hznFocusShell=Object.freeze({});\n/*WORKBOOK_FOCUS_END*/\n";
    $demo = str_replace('paid', 'demo', $plain); $cipher = hznUiEncrypt($plain, $key);
    $entry = fn($bytes) => ['bytes' => strlen($bytes), 'sha256' => hznUiHash($bytes), 'mime' => 'application/javascript'];
    $d = ['version' => '1.4.5', 'edition' => 'demo', 'chapterIds' => ['baa','dhaa_emphatic','daad','yaa','dhaal'],
        'files' => ['workbook.js' => $entry($demo), 'course/sample.mp3' => $entry('audio-sentinel')], 'shell' => ['workbook.js']];
    $m = ['version' => '1.4.6', 'product' => 'horizons-arabic-level1', 'content_versions' => ['1.4.0','1.4.1'],
        'files' => ['workbook.js' => array_merge($entry($cipher), ['url' => 'content/1.4.1/workbook.js.hzn', 'encoding' => 'gzip', 'decoded_bytes' => strlen($plain)]),
            'course/sample.mp3' => $entry('encrypted-audio-sentinel')], 'groups' => ['all' => ['workbook.js']]];
    $dw = "// cached media retained\nconst CACHE='hzn-public-demo-'+VERSION+'-workbook-focus-20261005-r1';\nconst reuse='(?:creator-credit|demo-experience|comprehensive-meaning|workbook-focus)';\n";
    $pw = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1-blending4-20261004-r1-workbook-focus-20261005-r1-trial-pause-20261005-r1';\n// licence and cache handlers untouched\n";
    foreach (array_combine(HZN_UI_PATHS, [$demo,$cipher,hznUiJson($d)."\n",hznUiJson($m)."\n",$dw,$pw]) as $p => $raw) put($web.'/'.$p, $raw);
    $snapshot = hznUiSnapshot($web); $hashes = array_map(fn($x)=>$x['sha256'],$snapshot);
    $focus = ['release'=>'workbook-focus-20261005-r1','hashes'=>$hashes,'plain_after_sha256'=>hznUiHash($plain)];
    $focusRaw = hznUiJson($focus)."\n"; put($home.'/'.HZN_UI_RECEIPTS[0], $focusRaw, 0600);
    $trial = ['release'=>'trial-pause-20261005-r1','hashes'=>['learn/sw.js'=>$hashes['learn/sw.js']], 'focus_receipt_sha256'=>hznUiHash($focusRaw)];
    put($home.'/'.HZN_UI_RECEIPTS[1], hznUiJson($trial)."\n",0600);
    foreach (['course/paid-content.hzn','activation/untouched.php','learning/user-data.sqlite','learn/index.html','learn/web-locales.json'] as $p) put($web.'/'.$p,'DO-NOT-CHANGE-'.$p);
    return compact('home','web','key','plain','demo','snapshot','focus','trial');
}
function plan(array $f): array { global $RELEASE; return hznUiPrepare($f['web'],$RELEASE,$f['focus'],$f['trial'],$f['key']); }
function publish(array $f, array $p, ?callable $checkpoint = null, bool $verifyFailure = false): array {
    global $ROOT,$RELEASE;
    return hznUiPublish($f['web'],$p['before'],$p['after'],$p['inherited'],$p['metadata'],function()use($f,$verifyFailure,$ROOT,$RELEASE){
        $s=hznUiState($f['web'],$ROOT);check($s!==null);hznUiVerifyPaid($f['web'],$s,$RELEASE,$f['key']);
        if($verifyFailure)throw new RuntimeException('TEST_POST_VERIFY');
    },$checkpoint);
}
function unchanged(array $f): void {
    foreach($f['snapshot'] as $p=>$v) check(hznUiRead($f['web'].'/'.$p,0644)===$v['bytes'],'not restored '.$p);
}
function sentinels(array $f): void {
    foreach(['course/paid-content.hzn','activation/untouched.php','learning/user-data.sqlite','learn/index.html','learn/web-locales.json'] as $p) check(file_get_contents($f['web'].'/'.$p)==='DO-NOT-CHANGE-'.$p);
}
function treeHash(string $root): array {
    $all=[]; $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS));
    foreach($it as $p) if($p->isFile()) $all[$p->getPathname()]=[hash_file('sha256',$p->getPathname()),fileperms($p->getPathname())&0777];
    ksort($all);return $all;
}
function run(string $name, callable $f): void {
    global $results;try{$f();$results[]=['name'=>$name,'passed'=>true];echo "PASS $name\n";}
    catch(Throwable $e){$results[]=['name'=>$name,'passed'=>false,'error'=>$e->getMessage()];echo "FAIL $name: ".$e->getMessage()."\n";}
}
if (defined('HZN_UI_FIXTURE_ONLY')) return;
run('in_memory_plan_zero_files_changed',function(){ $f=fixture();$before=treeHash($f['home']);$p=plan($f);check(treeHash($f['home'])===$before);check(count($p['after'])===6);});
run('success_roundtrip_and_historical_paths',function()use($ROOT,$RELEASE){$f=fixture();$p=plan($f);publish($f,$p);$s=hznUiState($f['web'],$ROOT);check(!$s['journal_pending']);
    foreach($p['after'] as $n=>$bytes)check(hznUiRead($f['web'].'/'.$n,0644)===$bytes);
    check(hznUiDecrypt($p['after']['learn/content/1.4.1/workbook.js.hzn'],$f['key'])===$f['plain'].$RELEASE['addon']);
    foreach(HZN_UI_PATHS as $n) {check(str_starts_with(hznUiPreviousPath($f['web'],$n,$s),$s['baseline_root']));check(hznUiPreviousMode($n,$s)===0600);}
    check(hznUiPreviousPath($f['web'],'learn/index.html',$s)===$f['web'].'/learn/index.html');check(hznUiPreviousMode('learn/index.html',$s)===0644);sentinels($f);
});
for($i=0;$i<=6;$i++)run('failure_after_'.$i.'_writes_rolls_back',function()use($i){$f=fixture();$p=plan($f);rejects(fn()=>publish($f,$p,function($n)use($i){if($n===$i)throw new RuntimeException('TEST_FAILURE');}),'TEST_FAILURE');unchanged($f);sentinels($f);check(!file_exists($f['home'].'/.horizons-native-ui/pending.json'));});
run('post_verification_failure_rolls_back',function(){$f=fixture();$p=plan($f);rejects(fn()=>publish($f,$p,null,true),'TEST_POST_VERIFY');unchanged($f);check(!file_exists($f['home'].'/.horizons-native-ui/receipt.json'));});
run('rollback_then_republish',function()use($ROOT){$f=fixture();$p=plan($f);publish($f,$p);hznUiRollback($f['web']);unchanged($f);check(hznUiState($f['web'],$ROOT)===null);publish($f,$p);check(hznUiState($f['web'],$ROOT)!==null);});
run('repeat_publish_refused_without_overwrite',function(){$f=fixture();$p=plan($f);publish($f,$p);$a=treeHash($f['home']);rejects(fn()=>publish($f,$p),'EXISTING_TRANSACTION');check(treeHash($f['home'])===$a);});
run('wrong_input_hash_stops_before_writes',function(){$f=fixture();$p=plan($f);put($f['web'].'/try/workbook.js','foreign');$before=treeHash($f['web']);rejects(fn()=>publish($f,$p),'CONCURRENT_CHANGE');check(treeHash($f['web'])===$before);});
run('reject_extra_target',function(){$f=fixture();$p=plan($f);$p['after']['activation/untouched.php']='bad';rejects(fn()=>publish($f,$p),'TARGET_SET');unchanged($f);});
run('reject_wrong_mode',function(){$f=fixture();$p=plan($f);chmod($f['web'].'/try/workbook.js',0666);rejects(fn()=>publish($f,$p),'MODE');sentinels($f);});
run('reject_symlink',function(){$f=fixture();$p=plan($f);rename($f['web'].'/try/workbook.js',$f['home'].'/target');symlink($f['home'].'/target',$f['web'].'/try/workbook.js');rejects(fn()=>publish($f,$p),'SYMLINK');check(file_get_contents($f['home'].'/target')===$f['demo']);});
run('reject_hardlink',function(){$f=fixture();link($f['web'].'/try/workbook.js',$f['home'].'/other');rejects(fn()=>plan($f),'FILE');});
run('reject_parent_symlink',function(){$f=fixture();rename($f['web'].'/try',$f['home'].'/relocated');symlink($f['home'].'/relocated',$f['web'].'/try');rejects(fn()=>plan($f),'SYMLINK');});
run('concurrent_edit_preserved_and_recovery_refused',function(){$f=fixture();$p=plan($f);rejects(fn()=>publish($f,$p,function($n)use($f){if($n===2){put($f['web'].'/try/workbook.js','FOREIGN-EDIT');throw new RuntimeException('TEST_FAILURE');}}),'RECOVERY_REQUIRED');
    check(file_get_contents($f['web'].'/try/workbook.js')==='FOREIGN-EDIT');$before=treeHash($f['web']);rejects(fn()=>hznUiRecover($f['web']),'RECOVERY_CONFLICT');check(treeHash($f['web'])===$before);
});
run('changed_receipt_stops_without_overwrite',function(){$f=fixture();$p=plan($f);put($f['home'].'/'.HZN_UI_RECEIPTS[1],'foreign-receipt',0600);rejects(fn()=>publish($f,$p),'CONCURRENT_CHANGE');unchanged($f);});
run('active_tamper_is_detected',function()use($ROOT){$f=fixture();$p=plan($f);publish($f,$p);put($f['web'].'/learn/sw.js','foreign');rejects(fn()=>hznUiState($f['web'],$ROOT),'CONCURRENT_CHANGE');});
run('completed_rollback_refuses_foreign_edit',function(){$f=fixture();$p=plan($f);publish($f,$p);put($f['web'].'/learn/sw.js','foreign');$before=treeHash($f['web']);rejects(fn()=>hznUiRollback($f['web']),'RECOVERY_CONFLICT');check(treeHash($f['web'])===$before);});
run('cipher_rejects_wrong_key_and_tag',function(){$f=fixture();$c=$f['snapshot']['learn/content/1.4.1/workbook.js.hzn']['bytes'];rejects(fn()=>hznUiDecrypt($c,random_bytes(32)),'AUTHENTICATION_TAG');$c[strlen($c)-1]=chr(ord($c[strlen($c)-1])^1);rejects(fn()=>hznUiDecrypt($c,$f['key']),'AUTHENTICATION_TAG');});
run('manifest_preserves_all_other_entries',function(){$f=fixture();$p=plan($f);foreach(['try'=>false,'learn'=>true] as $edition=>$paid){$n=$edition.($paid?'/asset-manifest.json':'/demo-asset-manifest.json');$a=json_decode($p['after'][$n],true);$b=json_decode($p['before'][$n]['bytes'],true);$a['files']['workbook.js']=$b['files']['workbook.js'];check($a===$b);}});
run('unknown_worker_rejected',function(){rejects(fn()=>hznUiWorker("const CACHE='unknown';",false),'WORKER_BASELINE');});
run('duplicate_adapter_rejected',function()use($RELEASE){$f=fixture();$once=hznUiAppend($f['plain'],$RELEASE['addon'],hznUiHash($f['plain']));rejects(fn()=>hznUiAppend($once,$RELEASE['addon'],hznUiHash($once)),'PLAYER_CONTRACT');});
run('release_hash_change_rejected',function()use($ROOT,$RELEASE){$pins=$RELEASE['sources'];$pins['native-experiences.js']=str_repeat('0',64);rejects(fn()=>hznUiAddon($ROOT,$pins),'SOURCE_CHANGED');});
run('metadata_cannot_store_a_key',function()use($RELEASE){$f=fixture();$p=plan($f);$p['metadata']['content_key']='forbidden';rejects(fn()=>hznUiMetadata($p['metadata'],$RELEASE),'METADATA');});
run('lock_refuses_parallel_publisher',function(){$f=fixture();$p=plan($f);$d=$f['home'].'/.horizons-native-ui';mkdir($d,0700);$h=fopen($d.'/publish.lock','c+b');chmod($d.'/publish.lock',0600);flock($h,LOCK_EX);try{rejects(fn()=>publish($f,$p),'BUSY');unchanged($f);}finally{flock($h,LOCK_UN);fclose($h);}});
if(function_exists('pcntl_fork')) {
    foreach([1,3,6] as $stop)run('process_interruption_recovery_'.$stop,function()use($stop){$f=fixture();$p=plan($f);$pid=pcntl_fork();check($pid!==-1);if($pid===0){publish($f,$p,function($n)use($stop){if($n===$stop)exit(0);});exit(5);}pcntl_waitpid($pid,$status);check(pcntl_wexitstatus($status)===0);check(file_exists($f['home'].'/.horizons-native-ui/pending.json'));hznUiRecover($f['web']);unchanged($f);sentinels($f);});
    run('corrupt_backup_refuses_recovery_before_writes',function(){$f=fixture();$p=plan($f);$pid=pcntl_fork();check($pid!==-1);if($pid===0){publish($f,$p,function($n){if($n===3)exit(0);});exit(5);}pcntl_waitpid($pid,$status);$r=json_decode(file_get_contents($f['home'].'/.horizons-native-ui/pending.json'),true);put($f['home'].'/.horizons-native-ui/tx-'.$r['transaction'].'/before/learn/sw.js','bad',0600);$before=treeHash($f['web']);rejects(fn()=>hznUiRecover($f['web']),'CONCURRENT_CHANGE');check(treeHash($f['web'])===$before);});
}
run('private_key_loader_no_output',function(){$f=fixture();put($f['home'].'/vault.json',hznUiJson(['product'=>'horizons-arabic-level1','content_key'=>base64_encode($f['key'])]),0600);put($f['home'].'/settings.php','<?php echo "PRIVATE_NOISE"; return '.var_export(['vault_path'=>$f['home'].'/vault.json'],true).';',0600);put($f['web'].'/activation/config-path.php','<?php echo "PRIVATE_POINTER"; return '.var_export($f['home'].'/settings.php',true).';');ob_start();$key=hznUiKey($f['web']);$out=ob_get_clean();check($out==='');check($key===$f['key']);});
run('private_key_loader_refuses_public_vault',function(){$f=fixture();put($f['web'].'/vault.json','{}',0600);put($f['home'].'/settings.php','<?php return '.var_export(['vault_path'=>$f['web'].'/vault.json'],true).';',0600);put($f['web'].'/activation/config-path.php','<?php return '.var_export($f['home'].'/settings.php',true).';');rejects(fn()=>hznUiKey($f['web']),'PRIVATE_VAULT');});
$report=['kind'=>'synthetic-publisher-filesystem-crypto','php'=>PHP_VERSION,'total'=>count($results),'passed'=>count(array_filter($results,fn($r)=>$r['passed'])),'tests'=>$results,'live_host_tested'=>false,'licensed_curriculum_tested'=>false,'browser_offline_tested'=>false];
if(!is_dir($ROOT.'/artifacts'))mkdir($ROOT.'/artifacts');file_put_contents($ROOT.'/artifacts/native-publication-results.json',json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
foreach($fixtures as $d){if(!str_starts_with($d,sys_get_temp_dir().'/hzn-ui-'))continue;$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()&&!$f->isLink()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($d);}
echo "RESULT ".$report['passed'].'/'.$report['total']." passed\n";exit($report['passed']===$report['total']?0:1);
