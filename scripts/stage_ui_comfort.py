#!/usr/bin/env python3
"""Build a NEW private staging player; never publish or overwrite the original.

Usage:
  python scripts/stage_ui_comfort.py --input /private/staging/workbook.js \
    --expected-sha256 <verified-input-sha256> --output /private/staging/workbook-comfort.js

The licensed player remains encrypted in production. This utility neither reads
activation settings nor decrypts content. Its output is not a release package:
new manifests, receipts, encrypted output and service-worker integration require
separate production verification. Do not check licensed plain players into Git.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / 'src/workbook-experiences/reader-comfort.css'
MARKER = '/*HZN_COMFORT_UI_BEGIN*/'

def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def build_player(original: bytes, css: str, expected: str) -> bytes:
    if not re.fullmatch(r'[0-9a-f]{64}', expected) or sha256(original) != expected:
        raise ValueError('Input SHA-256 differs from the explicitly verified baseline')
    if len(original) > 32 * 1024 * 1024:
        raise ValueError('Player exceeds the staging size limit')
    text = original.decode('utf-8')
    if text.count('/*WORKBOOK_FOCUS_BEGIN*/') != 1 or text.count('/*WORKBOOK_FOCUS_END*/') != 1:
        raise ValueError('Expected exactly one existing focus shell in this player')
    if MARKER in text:
        raise ValueError('Comfort layer already present; use a verified original')
    if not css.strip() or '</style' in css.lower():
        raise ValueError('Invalid stylesheet')
    payload = json.dumps(css, ensure_ascii=True).replace('<', '\\u003c')
    # Appending a separate presentation-only IIFE preserves every original byte.
    addition = (f'\n;{MARKER}\n(function(){{\n"use strict";\n'
        f'if(document.getElementById("hzn-comfort-style"))return;\n'
        f'const style=document.createElement("style");style.id="hzn-comfort-style";\n'
        f'style.textContent={payload};\n'
        f'function mount(){{if(document.head&&!style.isConnected)document.head.appendChild(style);}}\n'
        f'if(document.head)mount();else document.addEventListener("DOMContentLoaded",mount,{{once:true}});\n'
        f'}})();\n/*HZN_COMFORT_UI_END*/\n')
    return original + addition.encode('utf-8')

def private_output(path: Path) -> None:
    # Accidental document-root publication is explicitly unsupported.
    forbidden = {'public_html', 'wwwroot', 'htdocs'}
    if any(part.lower() in forbidden for part in path.parts):
        raise ValueError('Choose a private staging directory, not a document root')
    if path.is_symlink() or path.exists():
        raise ValueError('Output already exists or is a symlink; refusing overwrite')

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--expected-sha256',required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    try:
        if args.input.is_symlink() or not args.input.is_file():
            raise ValueError('Input must be an ordinary, readable player file')
        output=args.output.absolute()
        private_output(output)
        if output.parent.resolve() != output.parent:
            raise ValueError('Output directory must be canonical without symlinks')
        if not output.parent.is_dir():
            raise ValueError('Create a private staging directory first')
        original=args.input.read_bytes()
        css=CSS.read_text(encoding='utf-8')
        built=build_player(original,css,args.expected_sha256)
        report_path=output.with_suffix(output.suffix+'.json')
        private_output(report_path)
        report={'kind':'private-staging-only','input_sha256':sha256(original),
            'output_sha256':sha256(built),'original_bytes_preserved':built.startswith(original),
            'css_sha256':sha256(css.encode()),'production_published':False,
            'four_experience_migration_complete':False}
        # Restrictive permissions, exclusive creation and no overwrite.
        fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(built)
        fd=os.open(report_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as stream:
            json.dump(report,stream,indent=2);stream.write('\n')
        print(json.dumps(report,indent=2))
        return 0
    except (ValueError,UnicodeError,OSError) as exc:
        print('STAGING REFUSED: '+str(exc),file=sys.stderr)
        return 1

if __name__=='__main__':
    raise SystemExit(main())
