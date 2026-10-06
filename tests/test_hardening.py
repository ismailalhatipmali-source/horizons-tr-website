"""Run real Apache authorization and isolated reversible publication fixtures."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import socket
import stat
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('HZN_TEST_PHP') or shutil.which('php')
APACHE = os.environ.get('HZN_TEST_APACHE') or shutil.which('apache2')
MODULES = Path(os.environ.get('HZN_TEST_APACHE_MODULES', '/usr/lib/apache2/modules'))
POLICY = ROOT / 'src/security/public.htaccess'

@unittest.skipUnless(PHP, 'PHP CLI required')
class ReversiblePublicationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='hzn-hardening-')
        self.home = Path(self.tmp.name)
        self.web = self.home / 'public_html'; self.web.mkdir()
        self.target = self.web / '.htaccess'
        self.original = b'# host handler\r\nAddHandler fixture .php\r\n# host tail'
        self.target.write_bytes(self.original); self.target.chmod(0o640)

    def tearDown(self): self.tmp.cleanup()

    def run_cli(self, action, *args, web=None):
        return subprocess.run([PHP, str(ROOT / 'scripts/deploy-hardening.php'), action,
                               str(web or self.web), *map(str, args)], capture_output=True, text=True)

    def apply(self):
        result = self.run_cli('apply')
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data['status'], 'applied')
        return Path(data['batch'])

    def test_status_read_only_apply_idempotent_exact_restore(self):
        result = self.run_cli('status')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.target.read_bytes(), self.original)
        self.assertEqual(list(self.home.iterdir()), [self.web])
        batch = self.apply()
        self.assertTrue(self.target.read_bytes().endswith(self.original))
        self.assertEqual((batch / 'root.htaccess.original').read_bytes(), self.original)
        manifest = json.loads((batch / 'manifest.json').read_text())
        self.assertEqual(manifest['original_sha256'], hashlib.sha256(self.original).hexdigest())
        self.assertEqual(manifest['original_mode'], 0o640)
        self.assertEqual(manifest['published_sha256'], hashlib.sha256(self.target.read_bytes()).hexdigest())
        self.assertEqual(stat.S_IMODE(batch.stat().st_mode), 0o700)
        for item in batch.iterdir(): self.assertEqual(stat.S_IMODE(item.stat().st_mode), 0o600)
        result = self.run_cli('apply')
        self.assertEqual(json.loads(result.stdout)['status'], 'unchanged')
        self.assertEqual(len(list(batch.parent.glob('batch-*'))), 1)
        current = self.target.read_bytes()
        result = self.run_cli('restore', batch)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.target.read_bytes(), self.original)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o640)
        retained = Path(json.loads(result.stdout)['retained_displaced_configuration'])
        self.assertEqual((retained / 'root.htaccess.displaced').read_bytes(), current)
        self.assertFalse((batch.parent / 'lock').exists())

    def test_absent_original_is_moved_private_on_restore(self):
        self.target.unlink()  # synthetic fixture only
        batch = self.apply()
        result = self.run_cli('restore', batch)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.target.exists())
        retained = Path(json.loads(result.stdout)['retained_displaced_configuration'])
        self.assertTrue((retained / 'root.htaccess.removed-from-public').is_file())
        self.assertEqual(stat.S_IMODE((retained / 'root.htaccess.removed-from-public').stat().st_mode), 0o600)

    def test_restore_rejects_later_edit_or_corrupt_backup_and_unlocks(self):
        batch = self.apply(); hardened = self.target.read_bytes()
        self.target.write_bytes(hardened + b'# later operator edit\n')
        result = self.run_cli('restore', batch)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(self.target.read_bytes().endswith(b'# later operator edit\n'))
        self.assertFalse((batch.parent / 'lock').exists())
        self.target.write_bytes(hardened)
        (batch / 'root.htaccess.original').write_bytes(b'corrupt')
        result = self.run_cli('restore', batch)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.target.read_bytes(), hardened)
        self.assertFalse((batch.parent / 'lock').exists())

    def test_symlinks_and_malformed_markers_are_rejected(self):
        alias = self.home / 'alias'; alias.symlink_to(self.web, target_is_directory=True)
        self.assertNotEqual(self.run_cli('apply', web=alias).returncode, 0)
        self.target.write_text('# BEGIN HORIZONS HARDENING\nmissing end\n')
        before = self.target.read_bytes()
        self.assertNotEqual(self.run_cli('apply').returncode, 0)
        self.assertEqual(self.target.read_bytes(), before)
        self.target.unlink(); self.target.symlink_to(self.home / 'outside')
        self.assertNotEqual(self.run_cli('apply').returncode, 0)
        self.assertFalse((self.home / 'outside').exists())

    def test_source_policy_matches_release_policy(self):
        release = (ROOT / 'dist/.htaccess').read_text()
        self.assertEqual(release.count('# BEGIN HORIZONS HARDENING'), 1)
        self.assertIn(POLICY.read_text().strip() + '\n', release)

    def test_existing_guard_moves_before_host_passthrough_without_duplication(self):
        policy = POLICY.read_bytes()
        self.original = b'RewriteEngine On\nRewriteRule ^ - [L]\n' + policy + b'# host tail\n'
        self.target.write_bytes(self.original)
        batch = self.apply()
        self.assertEqual(self.target.read_bytes(), policy + b'RewriteEngine On\nRewriteRule ^ - [L]\n# host tail\n')
        self.assertEqual(json.loads(self.run_cli('apply').stdout)['status'], 'unchanged')
        self.assertEqual(self.run_cli('restore', batch).returncode, 0)
        self.assertEqual(self.target.read_bytes(), self.original)

@unittest.skipUnless(APACHE and MODULES.is_dir(), 'Apache 2.4 binary and modules required')
class ApacheAccessTests(unittest.TestCase):
    def test_real_requests_block_probes_and_preserve_routes(self):
        with tempfile.TemporaryDirectory(prefix='hzn-apache-') as tmp:
            base = Path(tmp); base.chmod(0o755)
            web = base / 'public_html'; web.mkdir(mode=0o755)
            def write(path, text):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.parent.chmod(0o755)
                path.write_text(text); path.chmod(0o644)
            write(web / '.htaccess', (ROOT / 'dist/.htaccess').read_text())
            allowed = ['index.html', 'ar/index.html', 'en/index.html', 'try/index.html',
                       'learn/index.html', 'learn/content/1.4.0/app.hzn', 'assets/app.js',
                       'assets/picture.webp', 'downloads/setup.exe', 'downloads/product.zip',
                       'updates/arabic-level-1.json', '.well-known/acme-challenge/probe',
                       'activation/index.php', 'learning-api/index.php', 'checkout-api/index.php',
                       'manual-order-api/index.php', 'admin/index.php', 'travel-download/index.php']
            blocked = ['.env', '.env.production', 'php.ini', '.user.ini', '.htpasswd', '.git/config',
                       'error_log', 'runtime.log', '.cpanel.yml', 'activation/config.php.zip',
                       'activation/config-path.php', 'activation/config.php', 'learning-api/bootstrap.php',
                       'admin/key.bin', 'backup.sqlite', 'backup.sqlite-wal', 'database.sql.gz',
                       'index.php.bak', 'index.php~', 'private.pem', 'composer.json']
            for namespace in ['assets', 'downloads', 'updates', 'try', 'learn/content']:
                blocked += [namespace + '/probe.' + ext for ext in
                            ['php', 'PHP', 'php7', 'php82', 'phtml', 'pht', 'phar', 'phps', 'php.jpg', 'jpg.php8']]
            for route in allowed + blocked: write(web / route, 'INERT_FIXTURE:' + route)
            blocked += ['.htaccess', 'assets/probe%2ephp', 'assets/probe.%70hp',
                        'try/probe.php/extra', 'learn/content/probe.php.jpg/extra']
            # Test inherited protections even when an application has child rules.
            write(web / 'try/.htaccess', 'RewriteEngine On\nRewriteRule ^unrelated$ index.html [L]\n')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
            config = base / 'httpd.conf'
            modules = ['mpm_event', 'authz_core', 'authz_host', 'unixd', 'dir', 'mime', 'headers', 'rewrite']
            modules = [name for name in modules if (MODULES / ('mod_' + name + '.so')).is_file()]
            config.write_text('\n'.join([
                f'ServerRoot "{base}"', f'Listen 127.0.0.1:{port}', 'ServerName localhost',
                f'PidFile "{base}/httpd.pid"', f'ErrorLog "{base}/error.log"',
                'User www-data', 'Group www-data',
                *[f'LoadModule {name}_module "{MODULES}/mod_{name}.so"' for name in modules],
                f'TypesConfig "{base}/mime.types"', f'DocumentRoot "{web}"',
                f'<Directory "{web}">', 'AllowOverride All', 'Require all granted', '</Directory>',
            ]) + '\n')
            (base / 'mime.types').write_text('text/html html\napplication/json json\n')
            server = subprocess.Popen([APACHE, '-f', str(config), '-DFOREGROUND'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                for _ in range(100):
                    if server.poll() is not None:
                        self.fail(server.communicate()[1].decode())
                    try:
                        urllib.request.urlopen(f'http://127.0.0.1:{port}/index.html', timeout=.2).read()
                        break
                    except (OSError, urllib.error.URLError): time.sleep(.02)
                for route in allowed:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/{route}', timeout=3) as response:
                        self.assertEqual(response.status, 200, route)
                        self.assertEqual(response.read().decode(), 'INERT_FIXTURE:' + route)
                for route in blocked:
                    with self.assertRaises(urllib.error.HTTPError, msg=route) as failure:
                        urllib.request.urlopen(f'http://127.0.0.1:{port}/{route}', timeout=3)
                    self.assertEqual(failure.exception.code, 403, route)
                    self.assertNotIn('INERT_FIXTURE:', failure.exception.read().decode(), route)
            finally:
                server.terminate()
                try: server.communicate(timeout=5)
                except subprocess.TimeoutExpired: server.kill(); server.communicate()

if __name__ == '__main__': unittest.main()
