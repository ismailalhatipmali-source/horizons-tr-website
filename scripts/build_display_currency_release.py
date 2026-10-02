#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE='964de82';VERSION='global-currency-20261002'
files={}
def add(target,source):
 b=(ROOT/source).read_bytes();r=subprocess.run(['git','show',BASE+':'+source],cwd=ROOT,capture_output=True);prior=r.stdout if r.returncode==0 else None
 if b==prior:return
 files[target]={'source':source,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'before':hashlib.sha256(prior).hexdigest() if prior is not None else None}
for p in sorted((ROOT/'dist').glob('*/*.html')):add('public/'+str(p.relative_to(ROOT/'dist')),str(p.relative_to(ROOT)))
for name in ['checkout.js','display-currency.js','display-currency.css','display-currencies.json']:add('public/'+name,'dist/'+name)
add('private/DisplayExchangeRates.php','src/checkout/DisplayExchangeRates.php')
add('private/display-currencies.json','src/commerce/display-currencies.json')
add('public/checkout-api/index.php','src/checkout/public-index.php')
files=dict(sorted(files.items(),key=lambda p:(0 if p[0].startswith('private/') else 1 if p[0]=='public/checkout-api/index.php' else 2 if p[0].count('/')==1 else 3,p[0])))
requires=json.loads((ROOT/'release-assets/admin-fx-20261002/manifest.json').read_text())['requires']
d=ROOT/'release-assets'/VERSION;d.mkdir(exist_ok=True)
(d/'manifest.json').write_text(json.dumps({'version':VERSION,'baseline_local':BASE,'production_baseline':'13e7c0205247ad1327e248811ca627d8a8b78a02','requires':requires,'files':files},indent=2)+'\n')
print(VERSION,len(files),'files',sum(e['bytes'] for e in files.values()),'bytes')
