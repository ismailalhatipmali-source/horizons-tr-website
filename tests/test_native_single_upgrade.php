<?php
declare(strict_types=1);
define('HZN_UI_FIXTURE_ONLY', true);
require __DIR__ . '/test_native_publication.php';
$CURRENT = hznUiRelease($ROOT);
$LEGACY = hznUiRelease($ROOT, '061270ae375f730ba2ccc462ce671b079dc371990466f6983ff234108e2c852e');
function legacyFixture(): array {
    global $RELEASE, $LEGACY, $CURRENT, $ROOT;
    $RELEASE=$LEGACY; $f=fixture(); $p=plan($f); publish($f,$p);
    $RELEASE=$CURRENT; $f['installed']=hznUiState($f['web'],$ROOT);
    $f['prior']=hznUiSnapshot($f['web']); return $f;
}
function upgrade(array $f, ?callable $checkpoint=null): void {
    global $CURRENT,$ROOT;
    hznUiUpgrade($f['web'],$ROOT,$f['installed'],$CURRENT,$f['focus'],$f['trial'],$f['key'],$checkpoint);
}
run('legacy_receipt_verified_against_byte_exact_archive',function()use($ROOT,$LEGACY){
    $f=legacyFixture();$s=hznUiState($f['web'],$ROOT);hznUiVerifyPaid($f['web'],$s,$LEGACY,$f['key']);sentinels($f);
});
run('upgrade_plan_is_read_only',function()use($CURRENT){
    $f=legacyFixture();$before=treeHash($f['home']);
    hznUiPrepare($f['web'],$CURRENT,$f['focus'],$f['trial'],$f['key'],$f['installed']);
    check(treeHash($f['home'])===$before);sentinels($f);
});
run('single_upgrade_preserves_original_player_and_receipts',function()use($ROOT,$CURRENT){
    $f=legacyFixture();$inherited=hznUiInherited($f['home']);upgrade($f);
    $s=hznUiState($f['web'],$ROOT);hznUiVerifyPaid($f['web'],$s,$CURRENT,$f['key']);
    check($s['metadata']['manifest_sha256']===$CURRENT['manifest_sha256']);
    check(hznUiInherited($f['home'])===$inherited);
    check(hznUiRead($f['web'].'/try/workbook.js',0644)===$f['demo'].$CURRENT['addon']);
    check(hznUiDecrypt(hznUiRead($f['web'].'/learn/content/1.4.1/workbook.js.hzn',0644),$f['key'])===$f['plain'].$CURRENT['addon']);
    sentinels($f);
});
for($i=0;$i<=6;$i++)run('upgrade_failure_'.$i.'_restores_previous_published_ui',function()use($i,$ROOT,$LEGACY){
    $f=legacyFixture();rejects(fn()=>upgrade($f,function($n)use($i){if($n===$i)throw new RuntimeException('TEST_UPGRADE_FAILURE');}),'TEST_UPGRADE_FAILURE');
    foreach($f['prior'] as $p=>$row)check(hznUiRead($f['web'].'/'.$p,0644)===$row['bytes']);
    $s=hznUiState($f['web'],$ROOT);hznUiVerifyPaid($f['web'],$s,$LEGACY,$f['key']);sentinels($f);
});
run('upgrade_foreign_edit_blocks_writes',function(){
    $f=legacyFixture();put($f['web'].'/try/workbook.js','FOREIGN');$before=treeHash($f['home']);
    rejects(fn()=>upgrade($f),'CONCURRENT_CHANGE');check(treeHash($f['home'])===$before);sentinels($f);
});
if(function_exists('pcntl_fork'))run('interrupted_upgrade_recovers_to_original_single_reader',function()use($ROOT,$CURRENT){
    $f=legacyFixture();$pid=pcntl_fork();check($pid!==-1);
    if($pid===0){upgrade($f,function($n){if($n===3)exit(0);});exit(5);}
    pcntl_waitpid($pid,$status);check(pcntl_wexitstatus($status)===0);
    hznUiRecover($f['web']);unchanged($f);sentinels($f);
    check(hznUiState($f['web'],$ROOT)===null);
    $p=hznUiPrepare($f['web'],$CURRENT,$f['focus'],$f['trial'],$f['key']);publish($f,$p);
    check(hznUiState($f['web'],$ROOT)!==null);
});
$passed=count(array_filter($results,fn($r)=>$r['passed']));
foreach($fixtures as $d){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()&&!$f->isLink()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($d);}
echo 'RESULT '.$passed.'/'.count($results)." upgrade tests passed\n";exit($passed===count($results)?0:1);
