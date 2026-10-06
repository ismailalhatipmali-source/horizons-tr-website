"""Isolated deployment checks. Python is a developer-test tool, not a cPanel dependency."""
from pathlib import Path
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/deploy-cpanel.sh'
VERSION = '1.4.0'
WEB_VERSION = '1.4.4'
DEMO_VERSION = '1.4.3'
UPDATE = 'Horizons-Arabic-Level-1-1.4.0-update.zip'
SETUP = 'HORIZONS-Arabic-Setup-1.4.0.exe'

def archive(entries):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, value, mode in entries:
            info = zipfile.ZipInfo(name)
            info.create_system = 3
            info.external_attr = mode << 16
            z.writestr(info, value)
    return data.getvalue()

def regular(name, value):
    return name, value.encode() if isinstance(value, str) else value, stat.S_IFREG | 0o644

def snapshot(folder):
    result = {}
    for p in sorted(folder.rglob('*')):
        name = p.relative_to(folder).as_posix()
        if p.is_symlink(): result[name] = ('link', os.readlink(p))
        elif p.is_file(): result[name] = ('file', hashlib.sha256(p.read_bytes()).hexdigest(), stat.S_IMODE(p.stat().st_mode))
    return result

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='horizons-deploy-test-')
        self.base = Path(self.temp.name)
        self.repo = self.base / 'repo'
        self.target = self.base / 'public_html'
        (self.repo / 'scripts').mkdir(parents=True)
        shutil.copy2(SCRIPT, self.repo / 'scripts/deploy-cpanel.sh')
        self.assets = self.repo / 'release-assets' / VERSION
        self.payloads = {
            'learn': ('learn.zip', archive([regular('learn/index.html', 'new learning'), regular('learn/.htaccess', 'Options -Indexes'), regular('learn/content/1.4.0/book.hzn', 'encrypted fixture')])),
            'demo': ('demo.zip', archive([regular('try/index.html', 'new five-letter demo'), regular('try/course.json', '{"letters":["ب","ظ","ض","ي","ذ"]}')])),
            'setup': (SETUP, b'MZ-test-setup-fixture'),
            'update': ('update.zip', archive([regular('downloads/' + UPDATE, b'PK-test-update'), regular('updates/arabic-level-1.json', '{"signed":"new"}')])),
        }
        self.write_payloads()
        self.overlay = {
            'src/workbook-web/index.html': ('learn/index.html', 'online workbook 1.4.2'),
            'src/workbook-web/shell.js': ('learn/shell.js', 'online shell'),
            'src/learning-api/index.php': ('learning-api/index.php', '<?php /* API fixture */'),
            'src/learning-api/.htaccess': ('learning-api/.htaccess', 'Options -Indexes'),
            f'release-assets/{WEB_VERSION}/files/learn/content/1.4.1/app.hzn': ('learn/content/1.4.1/app.hzn', 'encrypted web patch'),
        }
        self.write_overlay()
        self.demo_overlay = {
            'src/demo-pwa/workbook.js': ('try/workbook.js', 'scoped demo navigation'),
            'src/demo-pwa/release-config.js': ('try/release-config.js', 'demo version 1.4.3'),
            'src/demo-pwa/sw.js': ('try/sw.js', 'demo worker 1.4.3'),
            f'release-assets/demo-{DEMO_VERSION}/files/try/demo-asset-manifest.json': ('try/demo-asset-manifest.json', '{"version":"1.4.3"}'),
        }
        self.write_demo_overlay()
        self.write(self.repo / 'dist/index.html', 'new home')
        self.write(self.repo / 'dist/release.json', '{"version":"1.4.0"}')
        self.write(self.repo / 'dist/.htaccess', 'Options -Indexes\n')
        self.write(self.repo / 'dist/ar/index.html', 'new Arabic home')
        for reserved in ['activation/config.php', 'try/stale-plaintext.txt', 'updates/arabic-level-1.json', 'downloads/unapproved.exe', '.user.ini', 'php.ini', '.well-known/host-proof']:
            self.write(self.repo / 'dist' / reserved, 'must never be copied')
        for name, value in {
            'index.html': 'old home', 'ar/index.html': 'old Arabic',
            'activation/config.php': 'SMTP_PRIVATE_SENTINEL',
            'activation/data/state.sqlite': 'ACTIVATION_DATABASE_SENTINEL',
            'learning-api/index.php': '<?php /* old API */',
            'learning-api/obsolete.php': '<?php /* old API route */',
            '.user.ini': 'PHP_USER_SENTINEL', 'php.ini': 'PHP_SENTINEL',
            '.well-known/host-proof': 'HOST_PROOF',
            'downloads/unrelated.zip': 'OTHER_PRODUCT',
            'downloads/' + SETUP: 'OLD_SETUP', 'downloads/' + UPDATE: 'OLD_UPDATE',
            'updates/arabic-level-1.json': 'OLD_FEED',
            'try/index.html': 'old demo', 'try/stale-full-chapter.txt': 'stale paid chapter',
            'learn/index.html': 'old learn', 'learn/old-bootstrap.js': 'old bootstrap',
            'learn/content/1.3.0/retained.hzn': 'old encrypted content',
            '.htaccess': 'HOST_RULE_BEFORE\n# BEGIN HORIZONS MANAGED\nOLD_MANAGED\n# END HORIZONS MANAGED\nHOST_RULE_AFTER\n',
        }.items(): self.write(self.target / name, value)
        self.write(self.base / 'horizons-learning/progress.sqlite', 'PRIVATE_PROGRESS_SENTINEL')

    def tearDown(self): self.temp.cleanup()

    @staticmethod
    def write(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)
        path.chmod(0o644)

    def write_payloads(self):
        if self.assets.exists(): shutil.rmtree(self.assets)
        self.assets.mkdir(parents=True)
        lines = ['HORIZONS_RELEASE_V1\t' + VERSION]
        for kind, (name, value) in self.payloads.items():
            directory = self.assets / kind
            directory.mkdir()
            chunks = [value[i:i+97] for i in range(0, len(value), 97)]
            for i, part in enumerate(chunks): (directory / ('part-%04d' % i)).write_bytes(part)
            lines.append('\t'.join([kind, name, str(len(value)), hashlib.sha256(value).hexdigest(), str(len(chunks))]))
        (self.assets / 'manifest.tsv').write_text('\n'.join(lines) + '\n')

    def run_deploy(self, env=None):
        return subprocess.run(['bash', str(self.repo / 'scripts/deploy-cpanel.sh'), str(self.target)], text=True, capture_output=True, env=env, timeout=45)

    def write_overlay(self):
        lines = [f'HORIZONS_WEB_OVERLAY_V1\t{WEB_VERSION}\t1.4.0']
        for source, (destination, value) in self.overlay.items():
            self.write(self.repo / source, value)
            payload = value.encode()
            lines.append('\t'.join([hashlib.sha256(payload).hexdigest(), str(len(payload)), source, destination]))
        self.write(self.repo / f'release-assets/{WEB_VERSION}/manifest.tsv', '\n'.join(lines) + '\n')

    def assert_rejected_without_public_changes(self):
        before = snapshot(self.target)
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(snapshot(self.target), before)
        self.assertFalse((self.base / '.horizons-deploy-public_html/deploy.lock').exists())
        return result

    def write_demo_overlay(self):
        lines = [f'HORIZONS_DEMO_OVERLAY_V1\t{DEMO_VERSION}\t{VERSION}']
        for source, (destination, value) in self.demo_overlay.items():
            self.write(self.repo / source, value)
            body = value.encode()
            lines.append('\t'.join([hashlib.sha256(body).hexdigest(), str(len(body)), source, destination]))
        self.write(self.repo / f'release-assets/demo-{DEMO_VERSION}/manifest.tsv', '\n'.join(lines) + '\n')

    def test_complete_deploy_preserves_host_data_and_repeat_is_stable(self):
        original = snapshot(self.target)
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.target / 'index.html').read_text(), 'new home')
        self.assertEqual((self.target / 'learn/index.html').read_text(), 'online workbook 1.4.2')
        self.assertEqual((self.target / 'learn/shell.js').read_text(), 'online shell')
        self.assertEqual((self.target / 'learn/content/1.4.1/app.hzn').read_text(), 'encrypted web patch')
        self.assertEqual((self.target / 'learn/content/1.4.0/book.hzn').read_text(), 'encrypted fixture')
        self.assertEqual((self.target / 'learning-api/index.php').read_text(), '<?php /* API fixture */')
        self.assertFalse((self.target / 'learning-api/obsolete.php').exists())
        self.assertEqual((self.base / 'horizons-learning/progress.sqlite').read_text(), 'PRIVATE_PROGRESS_SENTINEL')
        self.assertEqual((self.target / 'try/index.html').read_text(), 'new five-letter demo')
        self.assertEqual((self.target / 'try/workbook.js').read_text(), 'scoped demo navigation')
        self.assertEqual((self.target / 'try/course.json').read_text(), '{"letters":["ب","ظ","ض","ي","ذ"]}')
        self.assertFalse((self.target / 'try/stale-full-chapter.txt').exists())
        self.assertFalse((self.target / 'try/stale-plaintext.txt').exists())
        self.assertFalse((self.target / 'downloads/unapproved.exe').exists())
        self.assertFalse((self.target / 'learn/old-bootstrap.js').exists())
        after = snapshot(self.target)
        for name in ['activation/config.php', 'activation/data/state.sqlite', '.user.ini', 'php.ini', '.well-known/host-proof', 'downloads/unrelated.zip', 'learn/content/1.3.0/retained.hzn']:
            self.assertEqual(after[name], original[name], name)
        access = (self.target / '.htaccess').read_text()
        self.assertIn('HOST_RULE_BEFORE\n', access)
        self.assertIn('HOST_RULE_AFTER\n', access)
        self.assertNotIn('OLD_MANAGED', access)
        self.assertEqual(access.count('# BEGIN HORIZONS MANAGED'), 1)
        backups = list((self.base / '.horizons-deploy-public_html').glob('backup-*'))
        self.assertTrue(any((b / 'try/stale-full-chapter.txt').is_file() for b in backups))
        second = self.run_deploy()
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual(snapshot(self.target), after)

    def test_scoped_hardening_migrates_once_without_losing_host_rules(self):
        policy = '# BEGIN HORIZONS HARDENING\nNEW_GUARD\n# END HORIZONS HARDENING\n'
        self.write(self.repo / 'dist/.htaccess', 'Options -Indexes\n' + policy)
        self.write(self.target / '.htaccess', 'HOST_RULE_BEFORE\n# BEGIN HORIZONS HARDENING\nOLD_GUARD\n# END HORIZONS HARDENING\nHOST_RULE_AFTER\n')
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        current = (self.target / '.htaccess').read_text()
        self.assertEqual(current.count('# BEGIN HORIZONS HARDENING'), 1)
        self.assertTrue(current.startswith(policy))
        self.assertIn(policy, current)
        self.assertNotIn('OLD_GUARD', current)
        self.assertIn('HOST_RULE_BEFORE\n', current)
        self.assertIn('HOST_RULE_AFTER\n', current)

    def test_malformed_scoped_hardening_stops_before_public_writes(self):
        self.write(self.repo / 'dist/.htaccess', '# BEGIN HORIZONS HARDENING\nGUARD\n# END HORIZONS HARDENING\n')
        self.write(self.target / '.htaccess', 'HOST_RULE\n# BEGIN HORIZONS HARDENING\nmissing end\n')
        result = self.assert_rejected_without_public_changes()
        self.assertIn('Malformed HORIZONS hardening block', result.stderr)

    def test_corrupt_last_artifact_fails_before_public_writes(self):
        p = self.assets / 'update/part-0000'
        value = bytearray(p.read_bytes()); value[-1] ^= 1; p.write_bytes(value)
        result = self.assert_rejected_without_public_changes()
        self.assertIn('SHA-256 mismatch: update', result.stderr)

    def test_corrupt_demo_overlay_fails_before_public_writes(self):
        self.write(self.repo / 'src/demo-pwa/workbook.js', 'SCOPED DEMO NAVIGATION')
        result = self.assert_rejected_without_public_changes()
        self.assertIn('Demo overlay SHA-256 mismatch', result.stderr)

    def test_missing_demo_overlay_fails_before_public_writes(self):
        (self.repo / f'release-assets/demo-{DEMO_VERSION}/manifest.tsv').unlink()
        self.assert_rejected_without_public_changes()

    def test_demo_overlay_cannot_publish_activation_or_other_curriculum(self):
        self.demo_overlay['src/demo-pwa/workbook.js'] = ('activation/config.php', 'private fixture')
        self.write_demo_overlay()
        self.assert_rejected_without_public_changes()

    def test_demo_overlay_duplicate_is_rejected(self):
        path = self.repo / f'release-assets/demo-{DEMO_VERSION}/manifest.tsv'
        lines = path.read_text().splitlines()
        path.write_text('\n'.join(lines + [lines[1]]) + '\n')
        self.assert_rejected_without_public_changes()

    def test_demo_overlay_symlink_is_rejected(self):
        path = self.repo / 'src/demo-pwa/workbook.js'
        path.unlink()
        outside = self.base / 'outside-demo.js'
        outside.write_text('scoped demo navigation')
        path.symlink_to(outside)
        self.assert_rejected_without_public_changes()

    def test_missing_chunk_fails_before_public_writes(self):
        (self.assets / 'demo/part-0000').unlink()
        self.assert_rejected_without_public_changes()

    def test_corrupt_overlay_stops_before_public_writes(self):
        self.write(self.repo / 'src/workbook-web/shell.js', 'ONLINE SHELL')
        result = self.assert_rejected_without_public_changes()
        self.assertIn('Web overlay SHA-256 mismatch', result.stderr)

    def test_missing_overlay_manifest_stops_before_public_writes(self):
        (self.repo / f'release-assets/{WEB_VERSION}/manifest.tsv').unlink()
        result = self.assert_rejected_without_public_changes()
        self.assertIn('web overlay manifest', result.stderr)

    def test_overlay_cannot_replace_activation_configuration(self):
        self.overlay['src/learning-api/index.php'] = ('activation/config.php', '<?php /* wrong destination */')
        self.write_overlay()
        self.assert_rejected_without_public_changes()

    def test_overlay_cannot_publish_runtime_data(self):
        self.overlay['src/learning-api/data/progress.sqlite'] = ('learning-api/data/progress.sqlite', 'private database')
        self.write_overlay()
        result = self.assert_rejected_without_public_changes()
        self.assertIn('Runtime/private file', result.stderr)

    def test_overlay_symlink_source_is_rejected(self):
        source = self.repo / 'src/workbook-web/shell.js'
        source.unlink()
        outside = self.base / 'outside.js'
        outside.write_text('online shell')
        source.symlink_to(outside)
        self.assert_rejected_without_public_changes()

    def test_overlay_duplicate_destination_is_rejected(self):
        manifest = self.repo / f'release-assets/{WEB_VERSION}/manifest.tsv'
        contents = manifest.read_text()
        manifest.write_text(contents + contents.splitlines()[1] + '\n')
        result = self.assert_rejected_without_public_changes()
        self.assertIn('Duplicate web overlay destination', result.stderr)

    def test_zip_traversal_fails_even_with_correct_manifest_hash(self):
        self.payloads['learn'] = ('learn.zip', archive([regular('learn/index.html', 'x'), regular('learn/../../escape', 'bad')]))
        self.write_payloads()
        self.assert_rejected_without_public_changes()
        self.assertFalse((self.base / 'escape').exists())

    def test_zip_symlink_is_rejected_before_extraction(self):
        self.payloads['demo'] = ('demo.zip', archive([regular('try/index.html', 'x'), ('try/link', b'../../activation', stat.S_IFLNK | 0o777)]))
        self.write_payloads()
        self.assert_rejected_without_public_changes()

    def test_unexpected_update_path_is_rejected(self):
        self.payloads['update'] = ('update.zip', archive([regular('downloads/' + UPDATE, 'x'), regular('updates/arabic-level-1.json', 'x'), regular('activation/config.php', 'bad')]))
        self.write_payloads()
        self.assert_rejected_without_public_changes()

    def test_destination_symlink_is_rejected_before_public_writes(self):
        outside = self.base / 'outside'
        self.write(outside / 'safe.txt', 'do not touch')
        shutil.rmtree(self.target / 'learn')
        (self.target / 'learn').symlink_to(outside, target_is_directory=True)
        self.assert_rejected_without_public_changes()
        self.assertEqual((outside / 'safe.txt').read_text(), 'do not touch')

    def test_malformed_host_block_does_not_publish_anything(self):
        self.write(self.target / '.htaccess', 'HOST\n# BEGIN HORIZONS MANAGED\nUNCLOSED\n')
        self.assert_rejected_without_public_changes()

    def test_publication_error_restores_old_demo_downloads_and_website(self):
        before = snapshot(self.target)
        commands = self.base / 'test-bin'; commands.mkdir()
        wrapper = commands / 'mv'
        wrapper.write_text('#!/bin/bash\nif [[ "${@: -1}" == "$HZN_TEST_FAIL_DEST" && ! -e "$HZN_TEST_FAIL_ONCE" ]]; then : > "$HZN_TEST_FAIL_ONCE"; exit 41; fi\nexec /usr/bin/mv "$@"\n')
        wrapper.chmod(0o755)
        env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'], 'HZN_TEST_FAIL_DEST': str(self.target / 'index.html'), 'HZN_TEST_FAIL_ONCE': str(self.base / 'failure-fired')}
        result = self.run_deploy(env)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue((self.base / 'failure-fired').exists())
        self.assertEqual(snapshot(self.target), before)

    def test_failure_before_backup_move_keeps_original_file(self):
        before = snapshot(self.target)
        commands = self.base / 'test-bin'; commands.mkdir()
        wrapper = commands / 'mv'
        wrapper.write_text('#!/bin/bash\nif [[ "${@: -2:1}" == "$HZN_TEST_FAIL_SOURCE" && ! -e "$HZN_TEST_FAIL_ONCE" ]]; then : > "$HZN_TEST_FAIL_ONCE"; exit 41; fi\nexec /usr/bin/mv "$@"\n')
        wrapper.chmod(0o755)
        env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'], 'HZN_TEST_FAIL_SOURCE': str(self.target / 'downloads' / SETUP), 'HZN_TEST_FAIL_ONCE': str(self.base / 'failure-fired')}
        result = self.run_deploy(env)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue((self.base / 'failure-fired').exists())
        self.assertEqual(snapshot(self.target), before)

    def test_new_document_root_is_publicly_traversable(self):
        shutil.rmtree(self.target)
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for folder in [self.target, self.target / 'learn', self.target / 'try', self.target / 'downloads', self.target / 'updates', self.target / 'learning-api']:
            self.assertEqual(stat.S_IMODE(folder.stat().st_mode), 0o755, str(folder))
        self.assertEqual((self.target / 'learn/index.html').read_text(), 'online workbook 1.4.2')
        self.assertTrue((self.target / 'learning-api/index.php').is_file())

if __name__ == '__main__': unittest.main(verbosity=2)
