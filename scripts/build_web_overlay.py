#!/usr/bin/env python3
"""Build a small encrypted web update; private source/key never enter the repo.

Requires Python cryptography only on the release-builder, never on cPanel.
The original immutable 1.4.0 web archive is supplied separately.
"""
import argparse
import base64
import hashlib
import gzip
import json
import mimetypes
import os
from pathlib import Path, PurePosixPath
import zipfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PRODUCT = 'horizons-arabic-level1'
VERSION = '1.4.1'
BASE_SHA = '173316f5c7fce66254a4fb6e5357d72fff8f78fb2896b755053802e406cddfb9'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe(value):
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or str(p) != value or '\\' in value or any(ord(c)<32 for c in value):
        raise ValueError('Unsafe asset path')
    return value

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--app',type=Path,required=True)
    ap.add_argument('--vault',type=Path,required=True)
    ap.add_argument('--base-archive',type=Path,required=True)
    args=ap.parse_args();repo=args.repo.resolve();app=args.app.resolve()
    if repo==app or repo in app.parents or repo in args.vault.resolve().parents:
        raise ValueError('Private inputs must remain outside the public repository')
    if digest(args.base_archive.read_bytes())!=BASE_SHA:
        raise ValueError('Wrong base release archive')
    vault=json.loads(args.vault.read_text());key=base64.b64decode(vault['content_key'],validate=True)
    if vault.get('product')!=PRODUCT or len(key)!=32:raise ValueError('Wrong owner vault')
    aes=AESGCM(key);out=repo/'release-assets'/VERSION
    target=out/'files/learn';target.mkdir(parents=True,exist_ok=True)
    changed=[];expected=set()
    with zipfile.ZipFile(args.base_archive) as z:
        manifest=json.loads(z.read('learn/asset-manifest.json'))
        manifest['version']=VERSION;manifest['content_versions']=['1.4.0',VERSION]
        original=set(manifest['files'])
        for file in sorted(app.rglob('*')):
            if file.is_symlink():raise ValueError('Symlink in private application')
            if not file.is_file():continue
            path=safe(file.relative_to(app).as_posix());expected.add(path);plain=file.read_bytes()
            aad=(PRODUCT+'/'+path).encode();old=manifest['files'].get(path)
            if old:
                raw=z.read('learn/'+old['url'])
                if digest(raw)!=old['sha256']:raise ValueError('Base asset checksum mismatch')
                base_plain=aes.decrypt(raw[:12],raw[12:],aad)
                if path=='workbook-data.js' and base_plain!=plain:raise ValueError('Bundled curriculum must stay unchanged')
                if base_plain==plain and path!='workbook-data.js':continue
            if path.startswith('course/'):
                raise ValueError('This web update must not change curriculum or media')
            if file.suffix not in {'.js','.css','.html','.json','.svg','.txt'}:
                raise ValueError('Unexpected modified application file: '+path)
            url='content/'+VERSION+'/'+path+'.hzn';dest=target/url
            dest.parent.mkdir(parents=True,exist_ok=True)
            packed=gzip.compress(plain,compresslevel=9,mtime=0)
            compressed=len(plain)>1024 and len(packed)<len(plain)*0.9
            payload=packed if compressed else plain
            cipher=dest.read_bytes() if dest.exists() else b''
            try:reuse=aes.decrypt(cipher[:12],cipher[12:],aad)==payload
            except Exception:reuse=False
            if not reuse:
                nonce=os.urandom(12);cipher=nonce+aes.encrypt(nonce,payload,aad);dest.write_bytes(cipher)
            if aes.decrypt(cipher[:12],cipher[12:],aad)!=payload:raise ValueError('Encryption verification failed')
            mime={'js':'text/javascript; charset=utf-8','json':'application/json; charset=utf-8','css':'text/css; charset=utf-8','html':'text/html; charset=utf-8'}.get(file.suffix[1:],mimetypes.guess_type(path)[0] or 'application/octet-stream')
            manifest['files'][path]={'url':url,'sha256':digest(cipher),'bytes':len(cipher),'mime':mime}
            if compressed:manifest['files'][path].update(encoding='gzip',decoded_bytes=len(plain))
            if not old:
                for values in manifest['groups'].values():values.append(path);values.sort()
            changed.append({'path':path,'bytes':len(cipher),'plaintext_sha256':digest(plain),'ciphertext_sha256':digest(cipher)})
        if original-expected:raise ValueError('Application unexpectedly omitted base assets')
    (target/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    keep={manifest['files'][x['path']]['url'] for x in changed}
    for file in (target/'content'/VERSION).rglob('*'):
        if file.is_file() and file.relative_to(target).as_posix() not in keep:file.unlink()
    rows=[]
    for src,prefix in [(repo/'src/workbook-web','learn'),(repo/'src/learning-api','learning-api'),(target,'learn')]:
        for file in sorted(src.rglob('*')):
            if file.is_symlink():raise ValueError('Symlink in public release')
            if not file.is_file():continue
            rel=file.relative_to(src).as_posix();body=file.read_bytes()
            for secret in ('content_key','signing_private_key'):
                if vault[secret].encode() in body or base64.b64decode(vault[secret],validate=True) in body:raise ValueError('Private value in public output')
            rows.append((digest(body),str(len(body)),file.relative_to(repo).as_posix(),prefix+'/'+rel))
    if len({row[3] for row in rows})!=len(rows):raise ValueError('Duplicate overlay destination')
    (out/'manifest.tsv').write_text('HORIZONS_WEB_OVERLAY_V1\t'+VERSION+'\t1.4.0\n'+''.join('\t'.join(r)+'\n' for r in rows))
    report={'version':VERSION,'base_version':'1.4.0','encrypted_files_changed':changed,'unchanged_curriculum_and_media':True,'public_overlay_files':len(rows),'public_overlay_bytes':sum(int(r[1]) for r in rows),'owner_key_unchanged':True,'private_value_scan':'passed'}
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'version':VERSION,'changed_app_files':[x['path'] for x in changed],'overlay_files':len(rows),'overlay_bytes':report['public_overlay_bytes']}))

if __name__=='__main__':main()
