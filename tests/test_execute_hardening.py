"""Real Apache fixture for one-command publication and automatic reversal."""
from pathlib import Path
import http.client, http.server, json, os, shutil, socket, stat, subprocess, tempfile, threading, time, unittest, urllib.request

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('HZN_TEST_PHP') or shutil.which('php')
APACHE = os.environ.get('HZN_TEST_APACHE') or shutil.which('apache2')
MODULES = Path(os.environ.get('HZN_TEST_APACHE_MODULES', '/usr/lib/apache2/modules'))

@unittest.skipUnless(PHP and APACHE and MODULES.is_dir(), 'PHP and Apache are required')
class ExecuteHardeningTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='hzn-guarded-')
        self.home = Path(self.tmp.name); self.home.chmod(0o755)
        self.web = self.home / 'public_html'; self.web.mkdir(mode=0o755)
        for name in ['assets','learn','try','admin','travel-download','activation','learning-api','checkout-api','manual-order-api']:
            (self.web / name).mkdir(mode=0o755)
        for name in ['index.html','learn/index.html','try/index.html','admin/index.html','travel-download/index.html']:
            p=self.web/name; p.write_text('INERT PUBLIC PAGE '+name); p.chmod(0o644)
        for route,mode in [('checkout-api','bank_review'),('manual-order-api','manual_email')]:
            p=self.web/route/'index.html';p.write_text(json.dumps({'ok':True,'collection_enabled':False,'mode':mode}));p.chmod(0o644)
        p=self.web/'method-error.json';p.write_text('{"ok":false,"error":"METHOD_NOT_ALLOWED"}');p.chmod(0o644)
        self.original = b'Options -Indexes\nDirectoryIndex index.html\nErrorDocument 405 /method-error.json\nRewriteEngine On\nRewriteRule ^(?:activation|learning-api)/ - [R=405,END]\n'
        self.access = self.web / '.htaccess';self.access.write_bytes(self.original);self.access.chmod(0o644)
        (self.web / '.user.ini').write_text('allow_url_fopen = On\n');(self.web / '.user.ini').chmod(0o640)
        with socket.socket() as s:s.bind(('127.0.0.1',0));self.port=s.getsockname()[1]
        config=self.home/'httpd.conf'
        modules=['mpm_event','authz_core','authz_host','unixd','dir','mime','headers','rewrite']
        modules=[m for m in modules if (MODULES/('mod_'+m+'.so')).is_file()]
        config.write_text('\n'.join([
            f'ServerRoot "{self.home}"',f'Listen 127.0.0.1:{self.port}','ServerName localhost',
            f'PidFile "{self.home}/httpd.pid"',f'ErrorLog "{self.home}/error.log"','User www-data','Group www-data',
            *[f'LoadModule {m}_module "{MODULES}/mod_{m}.so"' for m in modules],
            f'TypesConfig "{self.home}/mime.types"',f'DocumentRoot "{self.web}"',
            f'<Directory "{self.web}">','AllowOverride All','Require all granted','</Directory>',
        ])+'\n')
        (self.home/'mime.types').write_text('text/html html\ntext/plain txt\n')
        self.server=subprocess.Popen([APACHE,'-f',str(config),'-DFOREGROUND'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.base=f'http://127.0.0.1:{self.port}'
        for _ in range(100):
            if self.server.poll() is not None:self.fail(self.server.communicate()[1].decode())
            try:urllib.request.urlopen(self.base+'/',timeout=.2).read();break
            except OSError:time.sleep(.02)

    def tearDown(self):
        self.server.terminate()
        try:self.server.communicate(timeout=5)
        except subprocess.TimeoutExpired:self.server.kill();self.server.communicate()
        self.tmp.cleanup()

    def invoke(self, base=None):
        # Match the hosting restriction without changing a system ini file.
        return subprocess.run([PHP,'-d','disable_functions=proc_open,exec,shell_exec,system,passthru,popen',
                               str(ROOT/'scripts/execute-hardening.php'),str(self.web),base or self.base,'--fixture'],
                              capture_output=True,text=True,timeout=40)

    def result(self, run):
        receipt=json.loads(run.stdout)
        return json.loads(Path(receipt['result']).read_text()),receipt

    def test_publish_http_verify_and_retain_all_probe_bytes_privately(self):
        run=self.invoke();self.assertEqual(run.returncode,0,run.stderr+run.stdout)
        result,receipt=self.result(run);self.assertEqual(result['status'],'applied_http_verified')
        self.assertIn(b'# BEGIN HORIZONS HARDENING',self.access.read_bytes())
        self.assertEqual((self.web/'.user.ini').read_text(),'allow_url_fopen = On\n')
        self.assertEqual(stat.S_IMODE((self.web/'.user.ini').stat().st_mode),0o640)
        self.assertEqual(result['web_ini_status'],'still_requires_actual_FPM_configuration_verification')
        self.assertEqual(result['execution'],{'child_processes':False,'http_transport':'verified_php_streams'})
        self.assertEqual(len(result['http_before']),9);self.assertEqual(len(result['http_after']),9)
        self.assertEqual(len(result['probe_checks']),14)
        private=Path(result['retained_probe_directory'])
        self.assertEqual(stat.S_IMODE(private.stat().st_mode),0o700)
        self.assertEqual(len(list(private.iterdir())),14)
        for p in private.iterdir():self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
        self.assertEqual(list((self.web/'assets').iterdir()),[])
        self.assertEqual((Path(receipt['batch'])/'root.htaccess.original').read_bytes(),self.original)
        repeat=self.invoke();self.assertEqual(repeat.returncode,0,repeat.stderr+repeat.stdout)
        second,_=self.result(repeat);self.assertEqual(second['status'],'verified_unchanged')

    def test_failed_http_check_restores_exact_bytes_and_keeps_evidence(self):
        access,apache_port=self.access,self.port
        class Proxy(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                conn=http.client.HTTPConnection('127.0.0.1',apache_port,timeout=5)
                try:
                    conn.request('GET',self.path);response=conn.getresponse();body=response.read();status=response.status
                    if self.path.startswith('/learn/?') and b'# BEGIN HORIZONS HARDENING' in access.read_bytes():status=503
                    self.send_response(status);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
                finally:conn.close()
        proxy=http.server.ThreadingHTTPServer(('127.0.0.1',0),Proxy)
        worker=threading.Thread(target=proxy.serve_forever,daemon=True);worker.start()
        try:run=self.invoke(f'http://127.0.0.1:{proxy.server_port}')
        finally:proxy.shutdown();proxy.server_close();worker.join(timeout=5)
        self.assertNotEqual(run.returncode,0)
        result,_=self.result(run);self.assertEqual(result['status'],'failed_restored')
        self.assertEqual(self.access.read_bytes(),self.original)
        self.assertEqual(stat.S_IMODE(self.access.stat().st_mode),0o644)
        self.assertTrue(Path(result['retained_probe_directory']).is_dir())
        self.assertEqual(list((self.web/'assets').iterdir()),[])

    def test_redirect_is_not_followed_or_treated_as_a_healthy_page(self):
        self.access.write_bytes(self.original+b'RewriteRule ^learn/ /try/ [R=302,END]\n')
        before=self.access.read_bytes();run=self.invoke();self.assertNotEqual(run.returncode,0)
        result,_=self.result(run);self.assertEqual(result['error'],'HTTP route failed: /learn/')
        self.assertNotIn('publication',result);self.assertEqual(self.access.read_bytes(),before)
        self.assertEqual(list((self.web/'assets').iterdir()),[])

    def test_oversized_response_refuses_publication(self):
        (self.web/'learn/index.html').write_bytes(b'A'*1048577)
        before=self.access.read_bytes();run=self.invoke();self.assertNotEqual(run.returncode,0)
        result,_=self.result(run);self.assertIn('exceeded the limit: /learn/',result['error'])
        self.assertNotIn('publication',result);self.assertEqual(self.access.read_bytes(),before)
        self.assertEqual(list((self.web/'assets').iterdir()),[])
        self.assertFalse((self.home/'.horizons-hardening-public_html/verification.lock').exists())

    def test_failed_baseline_never_publishes_and_never_creates_public_probes(self):
        self.access.write_bytes(self.original+b'RewriteRule ^learn/ - [R=503,END]\n')
        before=self.access.read_bytes();run=self.invoke();self.assertNotEqual(run.returncode,0)
        result,_=self.result(run);self.assertEqual(result['status'],'failed')
        self.assertNotIn('publication',result)
        self.assertEqual(self.access.read_bytes(),before)
        self.assertEqual(list((self.web/'assets').iterdir()),[])

if __name__=='__main__':unittest.main()
