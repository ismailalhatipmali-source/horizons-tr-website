from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import unittest

PHP = shutil.which('php')
SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/audit-public-metadata.php'

class PublicMetadataAuditTests(unittest.TestCase):
    def test_private_report_no_execution_no_symlink_follow_and_repeat(self):
        self.assertTrue(PHP, 'PHP CLI is required, not an optional skipped check')
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); web = home/'public_html'; web.mkdir()
            outside = home/'private'; outside.mkdir()
            (outside/'secret.txt').write_text('PRIVATE_SENTINEL')
            (web/'linked').symlink_to(outside, target_is_directory=True)
            (web/'probe.php.jpg').write_text('<?php file_put_contents("EXECUTED", "bad");')
            (web/'index.html').write_text('<img src="logo2.png">')
            report = home/'metadata.json'
            result = subprocess.run([PHP,str(SCRIPT),str(web),str(report)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            data = json.loads(report.read_text())
            self.assertTrue(data['complete'])
            self.assertEqual(data['counts']['symlink'],1)
            self.assertFalse(any('secret.txt' in e['path'] for e in data['entries']))
            self.assertIn('php_extension',next(e for e in data['entries'] if e['path']=='probe.php.jpg')['flags'])
            self.assertEqual(data['legacy_reference_scan']['matches']['logo2.png'],['index.html'])
            self.assertEqual(report.stat().st_mode & 0o777,0o600)
            self.assertFalse((web/'EXECUTED').exists())
            before = report.read_bytes()
            subprocess.run([PHP,str(SCRIPT),str(web),str(report)],check=True,capture_output=True)
            self.assertEqual(report.read_bytes(),before)
            blocked = subprocess.run([PHP,str(SCRIPT),str(web),str(web/'public-report.json')],capture_output=True)
            self.assertNotEqual(blocked.returncode,0)
            self.assertFalse((web/'public-report.json').exists())

if __name__ == '__main__': unittest.main(verbosity=2)
