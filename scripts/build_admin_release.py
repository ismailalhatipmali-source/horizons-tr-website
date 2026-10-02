#!/usr/bin/env python3
"""Create a bounded overlay against the last deployed checkout, without packaging customer data."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASELINE='cd70e22223bf0700816b0f4655c649bb972e24bd'
VERSION='admin-fx-20261002'
def sha(b):return hashlib.sha256(b).hexdigest()
def old(path):
 r=subprocess.run(['git','show',BASELINE+':'+path],cwd=ROOT,capture_output=True);return r.stdout if r.returncode==0 else None
files={}
def add(target,source,prior=True):
 b=(ROOT/source).read_bytes();previous=old(source) if prior else None
 if previous==b:return
 files[target]={'source':source,'bytes':len(b),'sha256':sha(b),'before':sha(previous) if previous is not None else None}
for p in sorted((ROOT/'dist').glob('*/*.html')):add('public/'+str(p.relative_to(ROOT/'dist')),str(p.relative_to(ROOT)))
for n in ['checkout.js','checkout.css','site.js']:add('public/'+n,'dist/'+n)
for n in ['ReviewOrders.php','ExchangeRates.php']:add('private/'+n,'src/checkout/'+n)
add('public/checkout-api/index.php','src/checkout/public-index.php')
for n in ['AdminStore.php','AdminService.php','AdminMailer.php']:add('admin/'+n,'src/admin/'+n,False)
for target,source in [('index.html','index.html'),('admin.css','admin.css'),('admin.js','admin.js'),('api.php','public-api.php'),('.htaccess','public.htaccess')]:add('public/admin/'+target,'src/admin/'+source,False)
add('public/downloads/HORIZONS-Arabic-Setup-1.5.0.exe','release-assets/windows-1.5.0/HORIZONS-Arabic-Setup-1.5.0.exe',False)
# Accept the original checkout baseline and the exact first admin release.
for target,e in files.items():
 if target.startswith('public/') and target.endswith('/product.html'):
  r=subprocess.run(['git','show','18730c0:'+e['source']],cwd=ROOT,capture_output=True)
  if r.returncode==0 and sha(r.stdout)!=e['sha256'] and sha(r.stdout)!=e['before']:
   e['before']=[e['before'],sha(r.stdout)]
priority=lambda p:(0 if not p.startswith('public/') else 1 if '/api.php' in p or '/checkout-api/' in p else 2 if p.count('/')==1 else 3,p)
files=dict(sorted(files.items(),key=lambda i:priority(i[0])))
requires=json.loads((ROOT/'release-assets/checkout-20261002/checkout-manifest.json').read_text())['requires']
d=ROOT/'release-assets'/VERSION;d.mkdir(exist_ok=True)
(d/'manifest.json').write_text(json.dumps({'version':VERSION,'baseline_local':BASELINE,'production_baseline':'ad0ae268c907cbf40e6373810bf9652d00389efd','requires':requires,'files':files},indent=2)+'\n')
print(VERSION,len(files),'files',sum(x['bytes'] for x in files.values()),'bytes')
