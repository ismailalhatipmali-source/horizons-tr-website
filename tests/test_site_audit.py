"""Prove the maintenance inventory does not execute evidence or follow symlinks."""
from pathlib import Path
import json, os, shutil, stat, subprocess, tempfile, unittest

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('HZN_TEST_PHP') or shutil.which('php')

@unittest.skipUnless(PHP, 'PHP CLI is required; this is not a production audit')
class SiteAuditTests(unittest.TestCase):
    def test_read_only_inventory_and_private_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp); web=home/'public_html'; web.mkdir()
            (web/'index.html').write_text('<a href="/try/">Demo</a>')
            (web/'try').mkdir(); (web/'try/index.html').write_text('five letters')
            (web/'phpstorm.php').write_text('<?php file_put_contents(__DIR__."/EXECUTED", "bad"); eval($input);')
            (web/'activation').mkdir(); (web/'activation/config-path.php').write_text('SECRET_SENTINEL')
            outside=home/'do-not-follow'; outside.mkdir(); (outside/'secret.php').write_text('SECRET_SENTINEL')
            (web/'upload').symlink_to(outside, target_is_directory=True)
            trash=home/'.trash'; trash.mkdir(); (trash/'ufo_shell.php').write_text('<?php exit("EVIDENCE_EXECUTED");')
            logs=home/'logs'; logs.mkdir()
            (logs/'horizons-tr.com.log').write_text('192.0.2.1 - - [05/Oct/2026] "POST /ufo_shell.php?secret=HIDDEN HTTP/1.1" 200 1 "-" "agent"\n')
            before={p.relative_to(home).as_posix():p.read_bytes() for p in home.rglob('*') if p.is_file() and not p.is_symlink()}
            out=home/'.horizons-audit-fixture'
            run=subprocess.run([PHP,str(ROOT/'scripts/audit-site.php'),str(web),str(out)],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            summary=json.loads((out/'summary.json').read_text())
            inventory=[json.loads(x) for x in (out/'public-inventory.jsonl').read_text().splitlines()]
            self.assertFalse((web/'EXECUTED').exists())
            self.assertFalse(any(x['path'].endswith('/secret.php') for x in inventory))
            self.assertEqual(summary['access_log_indicators'][0]['matches']['ufo_shell.php 200'],1)
            all_reports=''.join(p.read_text() for p in out.iterdir())
            for sensitive in ['SECRET_SENTINEL','HIDDEN','192.0.2.1','EVIDENCE_EXECUTED']:
                self.assertNotIn(sensitive,all_reports)
            for relative,content in before.items(): self.assertEqual((home/relative).read_bytes(),content)
            self.assertEqual(stat.S_IMODE(out.stat().st_mode),0o700)
            for p in out.iterdir(): self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
            again=subprocess.run([PHP,str(ROOT/'scripts/audit-site.php'),str(web),str(out)],capture_output=True,text=True)
            self.assertNotEqual(again.returncode,0)

    def test_public_output_and_symlink_webroot_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp); web=home/'public_html'; web.mkdir()
            alias=home/'web-alias';alias.symlink_to(web,target_is_directory=True)
            for source,out in [(web,web/'.horizons-audit-public'),(alias,home/'.horizons-audit-alias')]:
                run=subprocess.run([PHP,str(ROOT/'scripts/audit-site.php'),str(source),str(out)],capture_output=True,text=True)
                self.assertNotEqual(run.returncode,0)
                self.assertFalse(out.exists())

if __name__ == '__main__': unittest.main()
