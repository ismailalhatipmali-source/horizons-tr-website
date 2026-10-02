"""Install the exact update ZIP in disposable cPanel-shaped homes."""
from pathlib import Path
import hashlib
import json
import os
import sqlite3
import subprocess
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
BASELINE='ecf441d82844e0ba0e19abe1701442b48f80615d'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='hzn-install-')
        self.home=Path(self.temp.name);self.web=self.home/'public_html';self.app=self.home/'horizons-license/app'
        self.app.mkdir(parents=True);(self.web/'activation').mkdir(parents=True)
        for name in ['Core.php','Network.php','bootstrap.php']:
            (self.app/name).write_bytes(subprocess.check_output(['git','show',f'{BASELINE}:src/activation/{name}'],cwd=ROOT))
        (self.web/'activation/index.php').write_text('<?php /* previous router */')
        (self.web/'existing-progress.txt').write_text('existing progress fixture')
        with zipfile.ZipFile(ROOT.parent/'deliverables/HORIZONS-Memberships-1.4.4.zip') as z:z.extractall(self.home)
        self.bundle=self.home/'horizons-membership-update'
        fixture=self.home/'fixture.php'
        fixture.write_text('''<?php
require $argv[1].'/src/activation/Core.php';
$home=__DIR__;$private=$home.'/horizons-license';$pair=sodium_crypto_sign_keypair();
file_put_contents($private.'/vault.json',json_encode(['schema'=>1,'product'=>\\Horizons\\PRODUCT,'signing_private_key'=>base64_encode(sodium_crypto_sign_secretkey($pair)),'content_key'=>base64_encode(random_bytes(32))]));
$config=['payments_enabled'=>false,'code_path'=>$private.'/app','database_path'=>$private.'/activation.sqlite','vault_path'=>$private.'/vault.json','data_key'=>base64_encode(random_bytes(32))];
$store=new \\Horizons\\Store($config['database_path']);$store->account(hash('sha256','existing-test-account'),time());unset($store);
file_put_contents($private.'/config.php','<?php return '.var_export($config,true).';');
file_put_contents($home.'/public_html/activation/config-path.php','<?php return '.var_export($private.'/config.php',true).';');
''')
        subprocess.run([PHP,str(fixture),str(ROOT)],check=True,capture_output=True)
    def tearDown(self):self.temp.cleanup()
    def run_installer(self,install=False):return subprocess.run([PHP,str(self.bundle/'install.php')]+(['--install'] if install else []),text=True,capture_output=True)
    def test_dry_run_install_backup_preservation(self):
        protected=[self.app.parent/p for p in ['config.php','vault.json','activation.sqlite']]+[self.web/'activation/config-path.php',self.web/'existing-progress.txt']
        before={p:digest(p) for p in protected};old_router=digest(self.web/'activation/index.php')
        r=self.run_installer();self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn('READY',r.stdout)
        self.assertEqual(digest(self.web/'activation/index.php'),old_router);self.assertEqual(before,{p:digest(p) for p in protected})
        r=self.run_installer(True);self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn('INSTALLED',r.stdout);self.assertEqual(before,{p:digest(p) for p in protected})
        manifest=json.loads((self.bundle/'manifest.json').read_text())
        for source,expected in manifest['files'].items():
            top,name=source.split('/',1);base={'app':self.app,'commerce':self.app.parent/'commerce','public':self.web}[top];self.assertEqual(digest(base/name),expected,source)
        backups=list(self.app.parent.glob('membership-backup-*'));self.assertEqual(len(backups),1)
        with sqlite3.connect(backups[0]/'activation.sqlite') as backup_db,sqlite3.connect(protected[2]) as original_db:
            self.assertEqual(backup_db.execute('PRAGMA integrity_check').fetchone()[0],'ok');self.assertEqual(list(backup_db.iterdump()),list(original_db.iterdump()))
        self.assertTrue((backups[0]/'restore-map.json').is_file());self.assertIn("'transfer_sales_enabled'=>false",(self.app/'features.php').read_text())
    def test_changed_host_source_stops(self):
        (self.app/'Core.php').write_text('<?php /* changed by owner */');r=self.run_installer(True)
        self.assertNotEqual(r.returncode,0);self.assertIn('HOSTED_SOURCE_CHANGED',r.stderr);self.assertFalse((self.app/'features.php').exists())
    def test_corrupt_payload_stops(self):
        (self.bundle/'public/learn/license-core.js').write_text('corrupt fixture');r=self.run_installer(True)
        self.assertNotEqual(r.returncode,0);self.assertIn('PACKAGE_CHECKSUM_FAILED',r.stderr);self.assertFalse((self.app/'features.php').exists())

if __name__=='__main__':unittest.main()
