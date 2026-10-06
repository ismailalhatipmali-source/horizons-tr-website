import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

import yaml

SOURCE = pathlib.Path(__file__).resolve().parents[1]


class CpanelHardeningTask(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = pathlib.Path(self.temp.name) / 'hosting'
        self.repo = self.home / 'repositories/horizons-tr-website-live'
        self.web = self.home / 'public_html'
        self.repo.mkdir(parents=True)
        self.web.mkdir()
        self.receipt = self.home / 'invoked.txt'
        self.php = self.home / 'fixture-php'
        self.php.write_text('#!/bin/bash\nprintf "%s\\n" "$@" > "' + str(self.receipt) + '"\n')
        self.php.chmod(0o700)
        self.env = dict(os.environ, GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid',
                        GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid')
        self.git('init', '-q', '-b', 'main')
        (self.repo / 'scripts').mkdir()
        (self.repo / 'src/security').mkdir(parents=True)
        for name in ['scripts/execute-hardening.php', 'scripts/deploy-hardening.php', 'src/security/public.htaccess']:
            (self.repo / name).write_text('fixture\n')
        self.git('add', '.')
        self.git('commit', '-q', '-m', 'Reviewed fixture ancestor')
        ancestor = self.git('rev-parse', 'HEAD').stdout.strip()
        script = (SOURCE / 'scripts/deploy-cpanel-hardening.sh').read_text()
        script = script.replace('/home2/horizonstr', str(self.home))
        script = script.replace('/usr/local/cpanel/3rdparty/bin/git', shutil.which('git'))
        script = script.replace('/usr/local/bin/ea-php82', str(self.php))
        script = script.replace('4a9e26d0c3edec60787e6d42be1f7d2b1157763f', ancestor)
        self.script = self.repo / 'scripts/deploy-cpanel-hardening.sh'
        self.script.write_text(script)
        self.git('add', '.')
        self.git('commit', '-q', '-m', 'Scoped fixture task')

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, env=self.env, text=True, capture_output=True, check=True)

    def invoke(self, cwd=None):
        return subprocess.run(['/bin/bash', str(self.script)], cwd=cwd or self.repo,
                              env=self.env, text=True, capture_output=True)

    def test_clean_main_runs_only_guarded_transaction(self):
        data = yaml.safe_load((SOURCE / '.cpanel.yml').read_text())
        self.assertEqual(data['deployment']['tasks'], ['/bin/bash scripts/deploy-cpanel-hardening.sh'])
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('working_tree=clean', result.stdout)
        self.assertIn(self.git('rev-parse', 'HEAD').stdout.strip(), result.stdout)
        self.assertEqual(self.receipt.read_text().splitlines(), ['scripts/execute-hardening.php', str(self.web)])
        self.assertFalse((self.home / '.horizons-production-chain.lock').exists())

    def test_local_tracked_or_untracked_changes_refuse_publication(self):
        tracked = self.repo / 'src/security/public.htaccess'
        tracked.write_text('local modification\n')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertFalse(self.receipt.exists())
        tracked.write_text('fixture\n')
        (self.repo / 'operator-note.txt').write_text('retain\n')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertFalse(self.receipt.exists())

    def test_other_branch_refuses_publication(self):
        self.git('checkout', '-q', '-b', 'review')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertFalse(self.receipt.exists())

    def test_other_checkout_refuses_publication(self):
        self.assertNotEqual(self.invoke(self.home).returncode, 0)
        self.assertFalse(self.receipt.exists())

    def test_existing_deployment_lock_is_preserved(self):
        lock = self.home / '.horizons-production-chain.lock'
        lock.mkdir()
        (lock / 'operator-evidence').write_text('retain\n')
        self.assertNotEqual(self.invoke().returncode, 0)
        self.assertFalse(self.receipt.exists())
        self.assertEqual((lock / 'operator-evidence').read_text(), 'retain\n')


if __name__ == '__main__':
    unittest.main()
