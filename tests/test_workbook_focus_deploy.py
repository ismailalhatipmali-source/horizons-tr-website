"""UI successor invariants and isolated PHP transaction fault injection.

No production, private content, licences or real accounts are used. PHP cases
are explicitly skipped if no supported PHP runtime is available. These cases
verify the transaction; they do not represent a licensed full-app deployment.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('HZN_TEST_PHP') or shutil.which('php')
RELEASE = ROOT / 'release-assets/workbook-focus-20261005-r1'
PUBLIC = ['try/workbook.js', 'try/demo-asset-manifest.json', 'try/sw.js']
PATHS = PUBLIC + ['learn/content/1.4.1/workbook.js.hzn', 'learn/asset-manifest.json', 'learn/sw.js']
sha = lambda raw: hashlib.sha256(raw).hexdigest()

class SourceSafety(unittest.TestCase):
    def test_historical_sources_remain_pinned(self):
        for folder, key in [('blending4-20261004-r1', 'sources'), ('demo-experience-20261004-r1', 'input_sources'), ('comprehensive-meaning-20261004-r1', 'input_sources')]:
            manifest = json.loads((ROOT / 'release-assets' / folder / 'manifest.json').read_text())
            for path, digest in manifest[key].items():
                with self.subTest(path=path):
                    actual = ROOT/path
                    if path == 'scripts/comprehensive-meaning-preservation.php':
                        actual = RELEASE/'predecessors/comprehensive-meaning-preservation.php'
                    self.assertEqual(sha(actual.read_bytes()), digest)

    def test_preservation_bridges_retain_historical_pins(self):
        b4 = (ROOT/'scripts/blending4-preservation.php').read_text()
        cm = (ROOT/'scripts/comprehensive-meaning-preservation.php').read_text()
        self.assertIn("68059cbde172a66284d2f815a31d34c949e41f6b39c76597aa4a4bc8adb1b90a", b4)
        self.assertIn("488bbaee728c687fbb7bd4f5b308778648dd8eaef9fadf4558cf76bbd582b530", cm)
        self.assertIn('hznFocusPreviousPath($web,$p,$focus)', b4)
        self.assertIn('hznB4PreviousPath($web,$name,$blending4,$focus)', cm)
        self.assertNotIn('hznB4State(', (ROOT/'scripts/workbook-focus-preservation.php').read_text())

    def test_new_release_scope_and_demo_content(self):
        if not (RELEASE/'manifest.json').exists(): self.skipTest('Successor builder output not yet available')
        manifest = json.loads((RELEASE/'manifest.json').read_text())
        self.assertEqual(sha((RELEASE/'manifest.json').read_bytes()), (RELEASE/'manifest.sha256').read_text().strip())
        self.assertEqual(list(manifest['files']), PUBLIC)
        self.assertEqual(len(set(manifest['languages'])), 32)
        prior = ROOT/'release-assets/comprehensive-meaning-20261004-r1/files'
        for path, entry in manifest['files'].items():
            raw = (ROOT/entry['source']).read_bytes()
            self.assertEqual(sha(raw), entry['sha256'])
            self.assertEqual(len(raw), entry['bytes'])
            self.assertEqual(sha((prior/path).read_bytes()), entry['before'])
        before = json.loads((prior/PUBLIC[1]).read_text())
        after = json.loads((ROOT/manifest['files'][PUBLIC[1]]['source']).read_text())
        after['files']['workbook.js'] = before['files']['workbook.js']
        self.assertEqual(after, before, 'All teaching payload, IDs and existing demo restrictions remain identical')

@unittest.skipUnless(PHP, 'PHP runtime unavailable: transaction and PHP syntax checks not executed')
class PhpTransaction(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='hzn-focus-transaction-')
        self.home = Path(self.tmp.name)
        self.web = self.home/'public_html'; self.web.mkdir()
        for path in PATHS:
            p=self.web/path; p.parent.mkdir(parents=True, exist_ok=True); p.write_text('original:'+path); p.chmod(0o644)
        self.sentinel = self.home/'prior-receipt.json'; self.sentinel.write_text('immutable predecessor')
        self.script = self.home/'transaction.php'
        self.script.write_text('''<?php
        define('HZN_FOCUS_DEPLOY_LIBRARY_ONLY', true);
        require '''+json.dumps(str(ROOT/'scripts/deploy-workbook-focus.php'))+''';
        $web=$argv[1];$kind=$argv[2];$at=(int)($argv[3]??0);$originals=[];$payload=[];
        foreach(HZN_FOCUS_PATHS as $p){$originals[$p]=['bytes'=>hznFocusRead($web.'/'.$p),'mode'=>0644];$payload[$p]='updated:'.$p;}
        $receipt=['inherited_receipts'=>[],'synthetic_transaction_test'=>true];
        $checkpoint=function($n)use($kind,$at,$web){if($kind==='fault'&&$n===$at)throw new RuntimeException('SYNTHETIC_FAULT');if($kind==='concurrent'&&$n===1)file_put_contents($web.'/learn/content/1.4.1/workbook.js.hzn','external concurrent edit');if($kind==='concurrent-written'&&$n===1){file_put_contents($web.'/try/workbook.js','external later edit');throw new RuntimeException('SYNTHETIC_LATER_EDIT');}};
        $verify=function()use($kind){if($kind==='verify')throw new RuntimeException('SYNTHETIC_VERIFY_FAILURE');};
        try{hznFocusPublish($web,$payload,$originals,$receipt,$verify,$checkpoint);echo 'PASS';}
        catch(Throwable $error){echo $error->getMessage();exit(3);}
        ''')

    def tearDown(self): self.tmp.cleanup()

    def call(self,kind,at=0):
        return subprocess.run([PHP,str(self.script),str(self.web),kind,str(at)],capture_output=True,text=True)

    def assert_original(self, except_path=None):
        for path in PATHS:
            if path == except_path: continue
            self.assertEqual((self.web/path).read_text(),'original:'+path)
            self.assertEqual((self.web/path).stat().st_mode & 0o777,0o644)
        self.assertEqual(self.sentinel.read_text(),'immutable predecessor')

    def test_php_syntax(self):
        for name in ['deploy-workbook-focus.php','workbook-focus-preservation.php','blending4-preservation.php','comprehensive-meaning-preservation.php']:
            r=subprocess.run([PHP,'-l',str(ROOT/'scripts'/name)],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr+r.stdout)

    def test_success_keeps_private_backups_and_receipt(self):
        r=self.call('success');self.assertEqual(r.returncode,0,r.stderr+r.stdout)
        private=self.home/'.horizons-workbook-focus'
        self.assertEqual(private.stat().st_mode & 0o777,0o700)
        for path in PATHS:
            self.assertEqual((self.web/path).read_text(),'updated:'+path)
            self.assertEqual((private/'baseline'/path).read_text(),'original:'+path)
            self.assertEqual((private/'baseline'/path).stat().st_mode & 0o777,0o600)
        self.assertEqual((private/'receipt.json').stat().st_mode & 0o777,0o600)
        self.assertEqual(self.sentinel.read_text(),'immutable predecessor')

    def test_failure_after_each_write_restores_exact_bytes_and_modes(self):
        for at in range(1,7):
            with self.subTest(at=at):
                r=self.call('fault',at);self.assertEqual(r.returncode,3,r.stderr+r.stdout)
                self.assertIn('SYNTHETIC_FAULT',r.stdout);self.assert_original()
                self.assertFalse((self.home/'.horizons-workbook-focus').exists())

    def test_postwrite_verifier_failure_rolls_back(self):
        r=self.call('verify');self.assertEqual(r.returncode,3,r.stderr+r.stdout)
        self.assert_original();self.assertFalse((self.home/'.horizons-workbook-focus').exists())

    def test_concurrent_edit_is_rejected_and_not_overwritten(self):
        r=self.call('concurrent');self.assertEqual(r.returncode,3,r.stderr+r.stdout)
        self.assertIn('FOCUS_CONCURRENT_CHANGE',r.stdout)
        p='learn/content/1.4.1/workbook.js.hzn';self.assert_original(p)
        self.assertEqual((self.web/p).read_text(),'external concurrent edit')

    def test_rollback_preserves_concurrent_edit_of_written_file(self):
        r=self.call('concurrent-written');self.assertEqual(r.returncode,3,r.stderr+r.stdout)
        self.assertIn('FOCUS_RESTORE_REQUIRES_ATTENTION',r.stdout)
        self.assertEqual((self.web/'try/workbook.js').read_text(),'external later edit')
        self.assert_original('try/workbook.js')
        private=self.home/'.horizons-workbook-focus'
        self.assertTrue(private.is_dir(), 'Retain recovery evidence if restoration is unsafe')
        self.assertEqual((private/'baseline/try/workbook.js').read_text(),'original:try/workbook.js')

    def test_private_state_conflict_changes_no_public_files(self):
        private=self.home/'.horizons-workbook-focus';private.mkdir();(private/'preserve').write_text('existing')
        r=self.call('success');self.assertEqual(r.returncode,3,r.stderr+r.stdout)
        self.assertIn('FOCUS_PRIVATE_STATE_CONFLICT',r.stdout);self.assert_original()
        self.assertEqual((private/'preserve').read_text(),'existing')

    def test_symlink_target_rejected(self):
        path=self.web/PATHS[0];path.unlink();path.symlink_to(self.sentinel)
        r=self.call('success');self.assertNotEqual(r.returncode,0)
        self.assertEqual(self.sentinel.read_text(),'immutable predecessor')

    def test_rejected_dry_run_leaves_no_files_or_directories(self):
        before = {str(p.relative_to(self.home)): (p.read_bytes() if p.is_file() else None) for p in self.home.rglob('*')}
        r = subprocess.run([PHP, str(ROOT/'scripts/deploy-workbook-focus.php'), str(self.web)], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0, 'Synthetic root deliberately lacks approved receipts')
        after = {str(p.relative_to(self.home)): (p.read_bytes() if p.is_file() else None) for p in self.home.rglob('*')}
        self.assertEqual(after, before)

    def test_actual_public_demo_patch_matches_builder(self):
        if not (RELEASE/'manifest.json').exists(): self.skipTest('Successor builder output not yet available')
        code = "require "+json.dumps(str(ROOT/'scripts/workbook-focus-preservation.php'))+";$repo="+json.dumps(str(ROOT))+";$r=hznFocusRelease($repo);$old=file_get_contents($repo.'/release-assets/comprehensive-meaning-20261004-r1/files/try/workbook.js');$new=hznFocusPatch($old,$repo,$r,false);if(hash('sha256',$new)!==$r['files']['try/workbook.js']['sha256'])exit(1);echo 'PASS';"
        r = subprocess.run([PHP, '-r', code], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr+r.stdout)
        self.assertEqual(r.stdout, 'PASS')

    def test_historical_release_resolver_accepts_pinned_bridge_snapshot(self):
        if not (RELEASE/'manifest.json').exists(): self.skipTest('Successor builder output not yet available')
        code = "require "+json.dumps(str(ROOT/'scripts/blending4-preservation.php'))+";require "+json.dumps(str(ROOT/'scripts/comprehensive-meaning-preservation.php'))+";$repo="+json.dumps(str(ROOT))+";hznB4Release($repo);hznCMRelease($repo);echo 'PASS';"
        r = subprocess.run([PHP, '-r', code], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr+r.stdout)
        self.assertEqual(r.stdout, 'PASS')

    def test_paid_generic_component_transform_on_synthetic_fixture(self):
        if not (RELEASE/'manifest.json').exists(): self.skipTest('Successor builder output not yet available')
        # Generic published components only: this proves token transforms, not
        # compatibility with the inaccessible current licensed full application.
        script = self.home/'patch.php'
        script.write_text("<?php require "+json.dumps(str(ROOT/'scripts/workbook-focus-preservation.php'))+";$repo="+json.dumps(str(ROOT))+";"+r'''
        $r=hznFocusRelease($repo);
        $b3=file_get_contents($repo.'/src/workbook-web/blending3-component.js');
        $start='function mountBlending3Component(root,DATA,config){';
        $b3=rtrim(substr($b3,strpos($b3,$start)),"\r\n")."\n";
        $css=json_encode(file_get_contents($repo.'/src/workbook-web/blending3-responsive.css'),JSON_HEX_TAG|JSON_THROW_ON_ERROR);
        $marker='const SYNTHETIC_TEACHING_PAYLOAD="immutable-test-only";';
        $plain=$marker."\n".$b3."\n".$css."\n".file_get_contents($repo.'/src/workbook-web/blending4-extension.js')."\ninit();\n\n})();";
        $updated=hznFocusPatch($plain,$repo,$r,true);
        if(substr_count($updated,$marker)!==1||substr_count($updated,'/*WORKBOOK_FOCUS_BEGIN*/')!==1)exit(1);
        echo 'PASS';
        ''')
        r = subprocess.run([PHP, str(script)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr+r.stdout)
        self.assertEqual(r.stdout, 'PASS')

    def test_cipher_authentication_round_trip(self):
        code="define('HZN_FOCUS_DEPLOY_LIBRARY_ONLY',true);require "+json.dumps(str(ROOT/'scripts/deploy-workbook-focus.php'))+";$k=random_bytes(32);$p='synthetic application only';$c=hznFocusCipher($p,$k);if(hznFocusPlain($c,$k)!==$p)exit(1);$c[15]=chr(ord($c[15])^1);try{hznFocusPlain($c,$k);exit(2);}catch(Throwable $e){echo 'PASS';}"
        r=subprocess.run([PHP,'-r',code],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stderr+r.stdout);self.assertEqual(r.stdout,'PASS')

if __name__ == '__main__': unittest.main(verbosity=2)
