#!/usr/bin/env python3
"""Real PHP/PDO tests plus independent Node WebCrypto RSA-OAEP interoperability."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

php = os.environ.get('PHP_BIN', 'php')
root = Path(__file__).resolve().parent
result = json.loads(subprocess.check_output([php, str(root / 'run.php')], text=True))
fixture = Path(result.pop('interop_fixture'))
try:
    script = r'''
const fs=require('node:fs'), {webcrypto,createPrivateKey}=require('node:crypto');
(async()=>{
const f=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const key=await webcrypto.subtle.importKey('pkcs8',createPrivateKey(f.private_key).export({type:'pkcs8',format:'der'}),{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
const bytes=await webcrypto.subtle.decrypt({name:'RSA-OAEP',label:new TextEncoder().encode('horizons-arabic-level1/progress-auth')},key,Buffer.from(f.encrypted_nonce,'base64'));
if(Buffer.from(bytes).toString()!=='N'.repeat(32))throw Error('nonce mismatch');
try{await webcrypto.subtle.decrypt({name:'RSA-OAEP',label:new TextEncoder().encode('horizons-arabic-level1')},key,Buffer.from(f.encrypted_nonce,'base64'));throw Error('wrong label accepted')}catch(e){if(e.message==='wrong label accepted')throw e}
console.log('WebCrypto OAEP SHA-256 interoperability passed');
})().catch(e=>{console.error(e);process.exit(1)});
'''
    subprocess.run(['node', '-e', script, str(fixture)], check=True)
    result['checks'].append('node_webcrypto_oaep_sha256_interoperability')
    print(json.dumps(result, indent=2))
finally:
    shutil.rmtree(fixture.parent)
