#!/usr/bin/env python3
"""Append the native presentation layer to a NEW private staging player.

This is not a production publisher. Never export a licensed plaintext player.
Requires the caller's verified input SHA-256 and an existing focus shell.
No activation access, decryption, service worker, manifest or receipt changes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'src/workbook-experiences'
MARKER='/*HZN_NATIVE_EXPERIENCES_BEGIN*/'
SOURCES=('native-experiences.js','native-experiences.css','native-shadow.css','native-locales.json','native-art.json','native-visibility.css','compact-home.js','compact-home.css')
LANGS=set('en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split())
def digest(raw:bytes)->str: return hashlib.sha256(raw).hexdigest()
def assets(source:Path=SOURCE)->tuple[dict,dict]:
    blobs={name:(source/name).read_bytes() for name in SOURCES}
    source_copy=json.loads(blobs['native-locales.json'])
    if len(source_copy['keys'])!=27 or len(set(source_copy['keys']))!=27:raise ValueError('Unexpected locale keys')
    source_copy['rows']={lang:row.split('|') for lang,row in source_copy['rows'].items()}
    if any(len(row)!=27 for row in source_copy['rows'].values()):raise ValueError('Incomplete locale row')
    locales={lang:dict(zip(source_copy['keys'],row)) for lang,row in source_copy['rows'].items()}
    if set(locales)!=LANGS: raise ValueError('Expected all 32 native locale dictionaries')
    keys=set(locales['en'])
    if len(keys)!=27: raise ValueError('Unexpected locale contract')
    if any(set(row)!=keys or any(not isinstance(v,str) or not v.strip() for v in row.values()) for row in locales.values()):
        raise ValueError('Incomplete locale dictionary')
    art=json.loads(blobs['native-art.json'])
    if set(art)!={'map','companion'}:raise ValueError('Unexpected approved artwork')
    # Art is decorative, never replaces an educational image. Reject script/URL references.
    for svg in art.values():
        if not svg.lstrip().startswith('<svg ') or re.search(r'<(?:script|foreignObject)|\bon\w+\s*=|(?:href|src)\s*=\s*["\'](?!#)|url\(\s*["\']?https?:',svg,re.I):
            raise ValueError('Unsafe artwork')
    css=blobs['native-experiences.css'].decode('utf-8')+'\n'+blobs['native-visibility.css'].decode('utf-8')+'\n'+blobs['compact-home.css'].decode('utf-8')
    variables='body[data-hzn-experiences-ready]{'+''.join('--hzn-approved-'+k+':url("data:image/svg+xml,'+quote(v,safe='')+'");' for k,v in art.items())+'}\n'
    payload={'css':variables+css,'shadow':blobs['native-shadow.css'].decode('utf-8'),'locales':locales}
    hashes={name:digest(blob) for name,blob in blobs.items()}
    return payload,hashes

def build(original:bytes,expected:str,source:Path=SOURCE)->tuple[bytes,dict]:
    if not re.fullmatch(r'[0-9a-f]{64}',expected) or digest(original)!=expected:raise ValueError('Input hash mismatch')
    if len(original)>32*1024*1024:raise ValueError('Player too large')
    text=original.decode('utf-8')
    if any(text.count(marker)!=1 for marker in ('/*WORKBOOK_FOCUS_BEGIN*/','/*WORKBOOK_FOCUS_END*/')):
        raise ValueError('One verified native focus shell is required')
    if 'globalThis.hznFocusShell=Object.freeze' not in text:raise ValueError('Native reader API missing')
    if MARKER in text:raise ValueError('Native experiences already installed')
    if '/*HZN_COMFORT_UI_BEGIN*/' in text:raise ValueError('Use the original player, not phase-1 staging output')
    payload,hashes=assets(source)
    encoded=json.dumps(payload,ensure_ascii=True,separators=(',',':')).replace('<','\\u003c')
    script=(source/'native-experiences.js').read_text()
    addition=('\n;'+MARKER+'\n'+script+'\n;HZNInstallExperiences(window,document,'+encoded+');\n'+(source/'compact-home.js').read_text(encoding='utf-8')+'\n;HZNInstallCompactHome(window,document);\n/*HZN_NATIVE_EXPERIENCES_END*/\n').encode()
    result=original+addition
    report={'kind':'private-native-staging','version':'0.3.1','input_sha256':expected,'output_sha256':digest(result),
        'original_bytes_preserved':result[:len(original)]==original,'source_sha256':hashes,'languages':sorted(LANGS),
        'production_published':False,'authenticated_full_workbook_tested':False}
    return result,report

def validate_output(path:Path)->None:
    if path.is_symlink() or path.exists():raise ValueError('Refusing output overwrite')
    if any(p.lower() in {'public_html','htdocs','wwwroot'} for p in path.parts):raise ValueError('Private output required')
    if not path.parent.is_dir() or path.parent.resolve()!=path.parent:raise ValueError('Canonical private parent required')

def main()->int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--expected-sha256',required=True)
    parser.add_argument('--output',required=True,type=Path)
    a=parser.parse_args();created=[]
    try:
        if a.input.is_symlink() or not a.input.is_file():raise ValueError('Regular input required')
        out=a.output.absolute();report_path=out.with_suffix(out.suffix+'.json')
        for p in (out,report_path):validate_output(p)
        result,report=build(a.input.read_bytes(),a.expected_sha256)
        # No overwrite. Remove only files created by this transaction on failure.
        for p,raw in ((out,result),(report_path,(json.dumps(report,indent=2)+'\n').encode())):
            fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);created.append(p)
            with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
        print(json.dumps(report,indent=2));return 0
    except (OSError,ValueError,UnicodeError) as exc:
        for p in reversed(created):
            try:p.unlink()
            except OSError:pass
        print('STAGING REFUSED: '+str(exc),file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
