"""Small publication must preserve lessons and reject unexpected public changes."""
import hashlib, json, os, shutil, subprocess, tempfile, unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/deploy-storefront.php'
PHP = os.environ.get('PHP_BIN', 'php')
sha = lambda data: hashlib.sha256(data).hexdigest()

class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.repo = self.root / 'repo'
        self.web = self.root / 'public_html'
        for p in ['repo/scripts', 'repo/release-assets/1.4.4', 'repo/dist/ar', 'public_html/ar', 'public_html/learn']:
            (self.root / p).mkdir(parents=True, exist_ok=True)
        shutil.copy2(SCRIPT, self.repo / 'scripts/deploy-storefront.php')
        (self.web / 'learn/web-config.js').write_bytes(b'version1.4.4')
        (self.web / 'learn/lesson.hzn').write_bytes(b'UNCHANGED_LESSON')
        (self.web / 'ar/index.html').write_bytes(b'old')
        self.manifest = {'version':'1.4.4','requires':{'learn/web-config.js':sha(b'version1.4.4')},'files':{}}
        for name, data, before in [('ar/index.html',b'new',b'old'),('site-commerce.js',b'cart',None)]:
            (self.repo / 'dist' / name).write_bytes(data)
            self.manifest['files'][name]={'bytes':len(data),'sha256':sha(data),'before':sha(before) if before is not None else None}
        self.save()
    def tearDown(self): self.tmp.cleanup()
    def save(self): (self.repo/'release-assets/1.4.4/storefront-manifest.json').write_text(json.dumps(self.manifest))
    def run_publish(self, write=False):
        return subprocess.run([PHP,str(self.repo/'scripts/deploy-storefront.php'),str(self.web)]+(['--publish'] if write else []),text=True,capture_output=True)
    def test_preflight_publish_backup_repeat_and_lesson_preservation(self):
        self.assertEqual(self.run_publish().returncode,0)
        self.assertEqual((self.web/'ar/index.html').read_bytes(),b'old')
        result=self.run_publish(True); self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual((self.web/'ar/index.html').read_bytes(),b'new')
        self.assertEqual((self.web/'learn/lesson.hzn').read_bytes(),b'UNCHANGED_LESSON')
        backups=list((self.root/'.horizons-deploy-public_html').glob('storefront-backup-*'))
        self.assertEqual((backups[0]/'ar/index.html').read_bytes(),b'old')
        self.assertIn('CURRENT',self.run_publish(True).stdout)
    def test_conflicting_public_edit_and_bad_source_fail_before_writes(self):
        (self.web/'ar/index.html').write_bytes(b'owner edit')
        self.assertIn('PUBLIC_BASELINE_CHANGED',self.run_publish(True).stderr)
        self.assertFalse((self.web/'site-commerce.js').exists())
        (self.web/'ar/index.html').write_bytes(b'old')
        (self.repo/'dist/site-commerce.js').write_bytes(b'tampered')
        self.assertIn('SOURCE_CHECKSUM_FAILED',self.run_publish(True).stderr)
        self.assertEqual((self.web/'ar/index.html').read_bytes(),b'old')
    def test_requires_current_workbook_and_exclusive_lock(self):
        (self.web/'learn/web-config.js').write_bytes(b'old-version')
        self.assertIn('WORKBOOK_UPDATE_REQUIRED',self.run_publish(True).stderr)
        state=self.root/'.horizons-deploy-public_html'
        (state/'deploy.lock').mkdir()
        self.assertIn('DEPLOYMENT_ALREADY_RUNNING',self.run_publish(True).stderr)
        self.assertTrue((state/'deploy.lock').exists())
    def test_accepts_exact_git_blob_baseline(self):
        self.manifest['files']['ar/index.html']['before']='git-sha1:'+hashlib.sha1(b'blob 3\0old').hexdigest(); self.save()
        self.assertEqual(self.run_publish(True).returncode,0)
    def test_public_location_directory_permissions(self):
        geo=self.web/'assets/commerce-geo'; geo.mkdir(parents=True); geo.chmod(0o700)
        self.assertEqual(self.run_publish(True).returncode,0)
        self.assertEqual(geo.stat().st_mode & 0o777,0o755)
    def test_rejects_symlink_and_runtime_configuration(self):
        (self.web/'site-commerce.js').symlink_to(self.web/'learn/lesson.hzn')
        self.assertIn('SYMLINK_REJECTED',self.run_publish(True).stderr)
        (self.web/'site-commerce.js').unlink()
        self.manifest['files']['activation/config.php']=self.manifest['files']['site-commerce.js']; self.save()
        self.assertIn('UNAPPROVED_PATH',self.run_publish(True).stderr)

if __name__=='__main__': unittest.main()
