#!/usr/bin/env python3
"""Build the public overlay and private cPanel update; never include host keys."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
VERSION='1.4.4'
BASELINE='ecf441d82844e0ba0e19abe1701442b48f80615d'
digest=lambda b:hashlib.sha256(b).hexdigest()

def build():
    old=ROOT/'release-assets/1.4.2/files/learn'
    new=ROOT/f'release-assets/{VERSION}/files/learn'
    new.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((old/'asset-manifest.json').read_text())
    if manifest['version']!='1.4.2' or manifest['product']!='horizons-arabic-level1':raise ValueError('Unexpected predecessor')
    for entry in manifest['files'].values():
        path=old/entry['url']
        if path.is_file() and (len(path.read_bytes())!=entry['bytes'] or digest(path.read_bytes())!=entry['sha256']):raise ValueError('Encrypted asset checksum mismatch')
    for path in old.rglob('*'):
        if path.is_symlink():raise ValueError('Symlink in release')
        if path.is_file():
            target=new/path.relative_to(old);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
    manifest['version']=VERSION
    (new/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    entries=[]
    for directory,destination in [(ROOT/'src/workbook-web','learn'),(ROOT/'src/learning-api','learning-api'),(new,'learn')]:
        for path in sorted(directory.rglob('*')):
            if path.is_symlink():raise ValueError('Symlink in source')
            if path.is_file():entries.append((digest(path.read_bytes()),str(path.stat().st_size),path.relative_to(ROOT).as_posix(),destination+'/'+path.relative_to(directory).as_posix()))
    (new.parents[1]/'manifest.tsv').write_text('HORIZONS_WEB_OVERLAY_V1\t1.4.4\t1.4.0\n'+''.join('\t'.join(row)+'\n' for row in entries))
    output=ROOT.parent/'deliverables';output.mkdir(parents=True,exist_ok=True)
    bundle=output/'HORIZONS-Memberships-1.4.4.zip'
    payload={}
    for directory,prefix in [(ROOT/'src/activation','app'),(ROOT/'src/commerce','commerce')]:
        for path in directory.iterdir():
            if path.suffix in ('.php','.json') and (directory.name=='activation' or path.suffix=='.php') and path.name!='public-index.php':payload[prefix+'/'+path.name]=path.read_bytes()
    payload['app/features.php']=b"<?php\nreturn ['memberships_enabled'=>true,'transfer_sales_enabled'=>false];\n"
    for _,_,source,destination in entries:payload['public/'+destination]=(ROOT/source).read_bytes()
    payload['public/activation/index.php']=(ROOT/'src/activation/public-index.php').read_bytes()
    expected={name:digest(subprocess.check_output(['git','show',BASELINE+':src/activation/'+name],cwd=ROOT)) for name in ['Core.php','Network.php','bootstrap.php']}
    package_manifest={'version':VERSION,'baseline':expected,'files':{path:digest(body) for path,body in payload.items()}}
    packaged=dict(payload)
    packaged['manifest.json']=json.dumps(package_manifest,indent=2)+'\n'
    packaged['install.php']=(ROOT/'scripts/install_membership_update.php').read_bytes()
    packaged['README.txt']=(ROOT/'scripts/membership-install-guide.txt').read_bytes()
    with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
        for path,body in sorted(packaged.items()):
            info=zipfile.ZipInfo('horizons-membership-update/'+path,date_time=(2026,10,2,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100600<<16;z.writestr(info,body)
    print(json.dumps({'bundle':str(bundle),'files':len(payload),'bytes':bundle.stat().st_size,'sha256':digest(bundle.read_bytes())}))

if __name__=='__main__':build()
