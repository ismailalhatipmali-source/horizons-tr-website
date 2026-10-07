"""Read-only host-check gate and preserved publication-chain contracts.
Tests use private temporary directories and a harmless PHP stand-in, never a host.
"""
from pathlib import Path
import hashlib
import json
import shlex
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE_BLOB = '3a8bfe2e0842a3598e6b760b269b94223584cfe9'
CANDIDATE_BLOB = '1ba6d713c3e9466e7c5b1642a602af8a8a9285ea'
SUFFIX = ' && /usr/local/bin/ea-php82 scripts/deploy-native-ui.php /home2/horizonstr/public_html --publish'
REPO = '/home2/horizonstr/repositories/horizons-tr-website-live'
WEB = '/home2/horizonstr/public_html'
LOCK = '/home2/horizonstr/.horizons-production-chain.lock'
PHP = '/usr/local/bin/ea-php82'

def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()

def task(path):
    return json.loads(path.read_text().split('    - ', 1)[1])

class PipelineTests(unittest.TestCase):
    def test_original_chain_is_unchanged(self):
        saved = ROOT / 'scripts/cpanel-production-before-native-ui.yml'
        candidate = ROOT / 'scripts/cpanel-native-ui-publish-candidate.yml'
        self.assertEqual(blob(saved.read_bytes()), BASE_BLOB)
        self.assertEqual(blob(candidate.read_bytes()), CANDIDATE_BLOB)
        self.assertEqual(task(candidate), task(saved) + SUFFIX)
        subprocess.run(['/bin/bash', '-n', '-c', task(candidate)], check=True, capture_output=True, timeout=5)

    def test_prior_failure_prevents_archived_ui_command(self):
        harmless = '/bin/bash -c "exit 7" && printf UI-RAN'
        r = subprocess.run(['/bin/bash', '-c', harmless], capture_output=True, timeout=5)
        self.assertEqual(r.returncode, 7)
        self.assertEqual(r.stdout, b'')

    def test_archived_success_runs_ui_after_first_shell_exits(self):
        harmless = '/bin/bash -c \'trap "printf released-" EXIT; printf old-\' && printf UI-RAN'
        r = subprocess.run(['/bin/bash', '-c', harmless], check=True, capture_output=True, timeout=5)
        self.assertEqual(r.stdout, b'old-released-UI-RAN')

    def test_current_cpanel_has_scoped_publish_gate(self):
        self.assertEqual(shlex.split(task(ROOT / '.cpanel.yml')), ['/bin/bash', 'scripts/publish-native-ui-host.sh'])
        wrapper = (ROOT / 'scripts/check-native-ui-host.sh').read_text()
        self.assertNotIn('--publish', wrapper)
        self.assertNotIn('--rollback', wrapper)
        self.assertNotIn('--recover', wrapper)
        subprocess.run(['/bin/bash', '-n', str(ROOT / 'scripts/check-native-ui-host.sh')], check=True, capture_output=True)

    def run_gate(self, *, publish=False, php_exit=0, branch='main', busy=False, linked=False, wrong_root=False, bad_web=False, missing_php=False):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            repo = home / 'repo'; repo.mkdir(); (repo / '.git').mkdir()
            (repo / '.git/HEAD').write_text('ref: refs/heads/' + branch + '\n')
            (repo / 'scripts').mkdir()
            (repo / 'scripts/deploy-native-ui.php').write_text('fixture only')
            if linked:
                (repo / 'scripts/deploy-native-ui.php').unlink()
                (repo / 'scripts/deploy-native-ui.php').symlink_to(home / 'absent')
            web = home / 'web'
            if not bad_web: web.mkdir()
            lock = home / 'lock'
            if busy: lock.mkdir()
            php = home / 'php'
            if not missing_php:
                php.write_text('#!/bin/bash\nprintf "PHP_ARGS:%s\\n" "$*"\nexit ' + str(php_exit) + '\n')
                php.chmod(0o700)
            script = (ROOT / ('scripts/publish-native-ui-host.sh' if publish else 'scripts/check-native-ui-host.sh')).read_text()
            for a,b in ((REPO,str(repo)),(WEB,str(web)),(LOCK,str(lock)),(PHP,str(php))):
                script = script.replace(a,b)
            def snapshot():
                return {str(f.relative_to(home)):(f.read_bytes(), f.stat().st_mode) for f in home.rglob('*') if f.is_file() and not f.is_symlink()}
            before = snapshot()
            r = subprocess.run(['/bin/bash','-c',script], cwd=home if wrong_root else repo, capture_output=True, timeout=5)
            self.assertEqual(snapshot(), before)
            self.assertFalse((home / '.horizons-native-ui').exists())
            return r, repo, web

    def test_success_invokes_only_check_and_preserves_files(self):
        r,repo,web = self.run_gate()
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertIn(('PHP_ARGS:-d display_errors=0 -d log_errors=0 ' + str(repo) + '/scripts/deploy-native-ui.php ' + str(web) + ' --check').encode(),r.stdout)
        self.assertNotIn(b'--publish',r.stdout)

    def test_publish_invokes_only_scoped_transaction(self):
        r,repo,web = self.run_gate(publish=True)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertIn(('PHP_ARGS:-d display_errors=0 -d log_errors=0 ' + str(repo) + '/scripts/deploy-native-ui.php ' + str(web) + ' --publish').encode(),r.stdout)

    def test_publish_failure_is_reported(self):
        r,_,_ = self.run_gate(publish=True,php_exit=9)
        self.assertEqual(r.returncode,9)

    def test_publish_busy_host_is_rejected(self):
        r,_,_ = self.run_gate(publish=True,busy=True)
        self.assertIn(b'BUSY',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_failure_propagates_without_publication(self):
        r,_,_ = self.run_gate(php_exit=9)
        self.assertEqual(r.returncode,9)
        self.assertNotIn(b'--publish',r.stdout)

    def test_wrong_branch_is_rejected(self):
        r,_,_ = self.run_gate(branch='other')
        self.assertIn(b'MAIN_REQUIRED',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_busy_host_is_rejected_without_removing_lock(self):
        r,_,_ = self.run_gate(busy=True)
        self.assertIn(b'BUSY',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_linked_entry_is_rejected(self):
        r,_,_ = self.run_gate(linked=True)
        self.assertIn(b'CHECK_ENTRY',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_wrong_root_is_rejected(self):
        r,_,_ = self.run_gate(wrong_root=True)
        self.assertIn(b'REPOSITORY',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_missing_web_is_rejected(self):
        r,_,_ = self.run_gate(bad_web=True)
        self.assertIn(b'DOCUMENT_ROOT',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

    def test_missing_php_is_rejected(self):
        r,_,_ = self.run_gate(missing_php=True)
        self.assertIn(b'PHP82',r.stderr)
        self.assertNotIn(b'PHP_ARGS',r.stdout)

if __name__ == '__main__':
    unittest.main(verbosity=2)
