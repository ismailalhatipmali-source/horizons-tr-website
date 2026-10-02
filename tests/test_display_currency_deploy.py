import hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];M=json.loads((ROOT/'release-assets/global-currency-20261002/manifest.json').read_text())
PHP=['/tmp/horizons-php','-d','extension=/tmp/horizons-commerce-php/usr/lib/php/20230831/curl.so']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(prefix='hzn-display-deploy-') as tmp:
 home=Path(tmp);web=home/'public_html';web.mkdir();private=home/'horizons-checkout-review';private.mkdir()
 def target(path):
  prefix,name=path.split('/',1);return (private if prefix=='private' else web)/name
 for path,e in M['files'].items():
  if e['before']:
   p=target(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',M['baseline_local']+':'+e['source']],cwd=ROOT));assert sha(p)==e['before']
 for path,h in M['requires'].items():
  p=web/path;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/('src/workbook-web/web-config.js' if path=='learn/web-config.js' else 'dist/'+path),p);assert sha(p)==h
 (private/'key.bin').write_bytes(os.urandom(32));shutil.copyfile(ROOT/'src/commerce/products.json',private/'products.json');shutil.copyfile(ROOT/'src/checkout/ExchangeRates.php',private/'ExchangeRates.php')
 sentinels=[home/'horizons-license/app/config.php',home/'horizons-license/activation.sqlite',private/'review-orders.sqlite',private/'fx-settings.json',home/'horizons-admin/owner.json']
 for p in sentinels:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'preserve-existing-content')
 def deploy(publish=False):return subprocess.run(PHP+[str(ROOT/'scripts/deploy-display-currency.php'),str(web)]+(['--publish'] if publish else []),capture_output=True,text=True)
 first=next(p for p,e in M['files'].items() if e['before']);p=target(first);prior=p.read_bytes();p.write_bytes(prior+b'user-edit');r=deploy(True);assert r.returncode==1 and 'PUBLIC_BASELINE_CHANGED' in r.stderr,r.stderr;assert not (private/'DisplayExchangeRates.php').exists();p.write_bytes(prior)
 r=deploy();assert r.returncode==0 and 'READY' in r.stdout,r.stderr
 r=deploy(True);assert r.returncode==0 and 'PUBLISHED' in r.stdout,r.stderr
 for path,e in M['files'].items():assert sha(target(path))==e['sha256'],path
 for path in ['private/DisplayExchangeRates.php','private/display-currencies.json']:assert target(path).stat().st_mode&0o777==0o600
 r=deploy(True);assert r.returncode==0 and 'CURRENT' in r.stdout,r.stderr
 assert all(p.read_bytes()==b'preserve-existing-content' for p in sentinels)
 backup=list((home/'.horizons-deploy-public_html').glob('global-currency-backup-*'));assert len(backup)==1
 for path,e in M['files'].items():
  if e['before']:assert sha(backup[0]/path)==e['before']
 # Public read-only API: no account/session creation, no arbitrary amount, authoritative product.
 api=web/'checkout-api/index.php'
 def endpoint(query,headers=None):
  server={'HTTPS':'on','DOCUMENT_ROOT':str(web),'REQUEST_METHOD':'GET','REMOTE_ADDR':'127.0.0.1',**(headers or {})}
  code='$_SERVER=json_decode('+json.dumps(json.dumps(server))+',true);$_GET=json_decode('+json.dumps(json.dumps(query))+',true);require '+json.dumps(str(api))+';'
  r=subprocess.run(PHP+['-r',code],capture_output=True,text=True);assert r.returncode==0,r.stderr;return json.loads(r.stdout)
 q={'action':'display_price','product':'horizons-arabic-level1','offer':'individual-monthly','currency':'USD','amount':'1'}
 response=endpoint(q);assert response['display']['amount_minor']==999 and response['display']['settlement_allowed'] is False and response['collection_enabled'] is False
 assert endpoint({**q,'quote_token':'tampered'})['error']=='FX_INVALID'
 assert endpoint({**q,'product':'fake'})['error']=='PRODUCT_UNAVAILABLE'
 assert endpoint(q,{'HTTP_ORIGIN':'https://other.example'})['error']=='FORBIDDEN'
 assert not list(home.rglob('*.hzn-new-*'))
print('PASS: exact production overlay, backups, conflict rejection, repeat-safe deployment, existing owner/license/mail/DB preserved, public API price authority and origin gates.')
