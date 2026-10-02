import hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=json.loads((ROOT/'release-assets/admin-fx-20261002/manifest.json').read_text())
PHP=['/tmp/horizons-php','-d','extension=/tmp/horizons-commerce-php/usr/lib/php/20230831/simplexml.so','-d','extension=/tmp/horizons-commerce-php/usr/lib/php/20230831/curl.so']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(prefix='hzn-admin-deploy-') as tmp:
 home=Path(tmp);web=home/'public_html';web.mkdir();private=home/'horizons-checkout-review';private.mkdir();admin=home/'horizons-admin'
 def target(path):
  base,s=path.split('/',1);return {'public':web,'private':private,'admin':admin}[base]/s
 for path,e in M['files'].items():
  if e['before']:
   p=target(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',M['baseline_local']+':'+e['source']],cwd=ROOT));assert sha(p)==(e['before'][0] if isinstance(e['before'],list) else e['before'])
 for path,h in M['requires'].items():
  p=web/path;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/('src/workbook-web/web-config.js' if path=='learn/web-config.js' else 'dist/'+path),p);assert sha(p)==h
 (private/'key.bin').write_bytes(os.urandom(32));shutil.copyfile(ROOT/'src/commerce/products.json',private/'products.json')
 sentinels=[home/'horizons-license/app/config.php',home/'horizons-license/activation.sqlite',home/'horizons-license/progress.sqlite',private/'review-orders.sqlite'];
 for p in sentinels:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'existing-data-must-be-preserved')
 def deploy(publish=False):return subprocess.run(PHP+[str(ROOT/'scripts/deploy-admin.php'),str(web)]+(['--publish'] if publish else []),capture_output=True,text=True)
 # User-edited existing files stop the entire deployment before any replacement.
 first=next(p for p,e in M['files'].items() if e['before']);p=target(first);old=p.read_bytes();p.write_bytes(old+b'changed');r=deploy(True);assert r.returncode==1 and 'PUBLIC_BASELINE_CHANGED' in r.stderr,r.stderr;assert not admin.exists();p.write_bytes(old)
 r=deploy();assert r.returncode==0 and 'READY' in r.stdout,r.stderr
 r=deploy(True);assert r.returncode==0 and 'PUBLISHED' in r.stdout,r.stderr
 for path,e in M['files'].items():assert sha(target(path))==e['sha256'],path
 assert (admin/'key.bin').stat().st_size==32 and (admin.stat().st_mode&0o777)==0o700
 assert all((p.stat().st_mode&0o777)==0o600 for p in admin.iterdir())
 key=(admin/'key.bin').read_bytes();r=deploy(True);assert r.returncode==0 and 'CURRENT' in r.stdout,r.stderr;assert (admin/'key.bin').read_bytes()==key
 assert all(p.read_bytes()==b'existing-data-must-be-preserved' for p in sentinels)
 backup=list((home/'.horizons-deploy-public_html').glob('admin-fx-backup-*'));assert len(backup)==1
 for path,e in M['files'].items():
  if e['before']:assert sha(backup[0]/path)==(e['before'][0] if isinstance(e['before'],list) else e['before'])
 # Also upgrade from the exact first admin release's product pages.
 for path,e in M['files'].items():
  if isinstance(e['before'],list):
   target(path).write_bytes(subprocess.check_output(['git','show','18730c0:'+e['source']],cwd=ROOT));assert sha(target(path)) in e['before']
 r=deploy(True);assert r.returncode==0 and 'PUBLISHED' in r.stdout,r.stderr
 # The anonymous API returns no catalog/customer/order data, and blocks writes/CSRF.
 api=web/'admin/api.php'
 def endpoint(method,action,headers=None):
  server={'HTTPS':'on','DOCUMENT_ROOT':str(web),'REQUEST_METHOD':method,'REMOTE_ADDR':'127.0.0.1',**(headers or {})}
  code='$_SERVER=json_decode('+json.dumps(json.dumps(server))+',true);$_GET=["action"=>'+json.dumps(action)+'];require '+json.dumps(str(api))+';'
  r=subprocess.run(PHP+['-r',code],capture_output=True,text=True);assert r.returncode==0,r.stderr;return json.loads(r.stdout)
 state=endpoint('GET','state');assert state['authenticated'] is False and 'catalog' not in state
 for action in ['orders','customers','reviews','audit']:assert endpoint('GET',action)['error']=='LOGIN_REQUIRED'
 assert endpoint('POST','state')['error']=='FORBIDDEN'
 assert endpoint('GET','state',{'HTTP_ORIGIN':'https://other.example'})['error']=='FORBIDDEN'
print('PASS: full overlay, preflight conflict rejection, backups, permissions, repeat-safe publish, existing mail/data/cover preserved; anonymous admin/CSRF/origin gates.')
