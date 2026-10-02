#!/usr/bin/env python3
"""Hash the checkout overlay against the exact published contact release."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASELINE='ee6558732406266d646e059b5d0aed17e3b042dd'
VERSION='checkout-20261002'
def sha(data):return hashlib.sha256(data).hexdigest()
def before(path):
    r=subprocess.run(['git','show',BASELINE+':'+path],cwd=ROOT,capture_output=True)
    return r.stdout if r.returncode==0 else None
files={}
paths=list((ROOT/'dist').glob('*/*.html'))+[ROOT/'dist'/n for n in ['checkout.html','cart.html','products.json','checkout.js','checkout.css','site-commerce.js']]
for p in sorted(paths):
    path=p.relative_to(ROOT).as_posix();old=before(path);data=p.read_bytes()
    if old==data:continue
    files['public/'+path[5:]]={'source':path,'bytes':len(data),'sha256':sha(data),'before':sha(old) if old is not None else None}
for target,source in [('public/checkout-api/index.php','src/checkout/public-index.php'),('public/checkout-api/.htaccess','src/checkout/public.htaccess'),('private/ReviewOrders.php','src/checkout/ReviewOrders.php'),('private/products.json','src/commerce/products.json')]:
    data=(ROOT/source).read_bytes();files[target]={'source':source,'bytes':len(data),'sha256':sha(data),'before':None}
priority=lambda path:(0 if path.startswith('private/') else 1 if path.startswith('public/checkout-api/') else 2 if path.count('/')==1 else 3,path)
files=dict(sorted(files.items(),key=lambda item:priority(item[0])))
requires={p:sha((ROOT/s).read_bytes()) for p,s in [('learn/web-config.js','src/workbook-web/web-config.js'),('assets/arabic-workbook-cover-approved.jpg','dist/assets/arabic-workbook-cover-approved.jpg')]}
manifest={'version':VERSION,'baseline_commit':BASELINE,'requires':requires,'files':files}
folder=ROOT/'release-assets'/VERSION;folder.mkdir(exist_ok=True)
(folder/'checkout-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Checkout release:',len(files),'files,',sum(x['bytes'] for x in files.values()),'bytes')
