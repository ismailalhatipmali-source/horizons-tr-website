"""Exercise server-owned-key encryption and reversible publication on a fixture."""
import base64,copy,gzip,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('HZN_TEST_PHP','php')
def digest(b):return hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory(prefix='hzn-phonics-deploy-') as d:
    home=Path(d);repo=home/'repo';web=home/'public_html';learn=web/'learn'
    learn.mkdir(parents=True);(web/'activation').mkdir();(repo/'scripts').mkdir(parents=True)
    shutil.copy(ROOT/'scripts/deploy-phonics.php',repo/'scripts/deploy-phonics.php')
    shutil.copytree(ROOT/'src/phonics',repo/'src/phonics')
    shutil.copytree(ROOT/'release-assets/phonics-20261003',repo/'release-assets/phonics-20261003')
    (repo/'release-assets/1.4.6/files/learn').mkdir(parents=True)
    key=os.urandom(32);aes=AESGCM(key);vault=home/'vault.json'
    vault.write_text(json.dumps({'product':'horizons-arabic-level1','content_key':base64.b64encode(key).decode()}))
    config=home/'config.php';config.write_text('<?php return ["vault_path"=>'+json.dumps(str(vault))+'];')
    (web/'activation/config-path.php').write_text('<?php return '+json.dumps(str(config))+';')
    # Use the real full player source hooks; the source-key is synthetic.
    original=(ROOT/'src/demo-pwa/workbook.js').read_bytes()
    packed=gzip.compress(original,mtime=0);nonce=os.urandom(12)
    cipher=nonce+aes.encrypt(nonce,packed,b'horizons-arabic-level1/workbook.js')
    manifest=json.loads((ROOT/'release-assets/1.4.6/files/learn/asset-manifest.json').read_text())
    manifest['files']['workbook.js']={'url':'content/1.4.1/workbook.js.hzn','sha256':digest(cipher),'bytes':len(cipher),'mime':'text/javascript; charset=utf-8','encoding':'gzip','decoded_bytes':len(original)}
    baseline=copy.deepcopy(manifest)
    target=learn/'content/1.4.1/workbook.js.hzn';target.parent.mkdir(parents=True);target.write_bytes(cipher)
    (learn/'asset-manifest.json').write_text(json.dumps(manifest))
    (repo/'release-assets/1.4.6/files/learn/asset-manifest.json').write_text(json.dumps(manifest))
    (learn/'sw.js').write_bytes((ROOT/'src/workbook-web/sw.js').read_bytes())
    def run():return subprocess.run([PHP,str(repo/'scripts/deploy-phonics.php'),str(web)],capture_output=True,text=True)
    before={p:p.read_bytes() for p in [target,learn/'asset-manifest.json',learn/'sw.js']}
    # A checksum failure must precede every public write.
    audio=next((repo/'release-assets/phonics-20261003/audio').glob('*.mp3'));correct=audio.read_bytes();audio.write_bytes(correct+b'bad')
    result=run();assert result.returncode!=0 and 'AUDIO_CHECKSUM_FAILED' in result.stderr,result.stderr
    assert all(p.read_bytes()==b for p,b in before.items())
    audio.write_bytes(correct)
    result=run();assert result.returncode==0,result.stderr
    live=json.loads((learn/'asset-manifest.json').read_text());assert live['phonics_release']=='phonics-20261003'
    new=set(live['files'])-set(baseline['files']);assert len(new)==168
    assert [p for p in baseline['files'] if baseline['files'][p]!=live['files'][p]]==['workbook.js']
    for path in new|{'workbook.js'}:
        entry=live['files'][path];p=learn/entry['url'];raw=p.read_bytes()
        assert digest(raw)==entry['sha256'] and len(raw)==entry['bytes']
        plain=aes.decrypt(raw[:12],raw[12:],('horizons-arabic-level1/'+path).encode())
        if path=='workbook.js':
            app=gzip.decompress(plain);assert len(app)==entry['decoded_bytes']
            assert app.count(b'// HZN_PHONICS_20261003_BEGIN')==1 and b'/*PHONICS_DATA*/' not in app
            check=home/'player.js';check.write_bytes(app)
            subprocess.run(['node','--check',str(check)],check=True,capture_output=True)
            start=app.index(b'\n// HZN_PHONICS_20261003_BEGIN\n');end=app.index(b'\n// HZN_PHONICS_20261003_END\n')+len(b'\n// HZN_PHONICS_20261003_END\n')
            assert app[:start]+app[end:]==original
        else:assert plain==(ROOT/'release-assets/phonics-20261003/audio'/Path(path).name).read_bytes()
        assert p.stat().st_mode&0o777==0o644 and p.parent.stat().st_mode&0o777==0o755
    receipt=home/'.horizons-phonics/receipt.json';assert receipt.stat().st_mode&0o777==0o600
    assert all(p in live['groups']['all'] for p in new) and len(live['groups']['phonics'])==169
    assert 'phonics-20261003' in (learn/'sw.js').read_text()
    result=run();assert result.returncode==0 and '0 files updated' in result.stdout,result.stdout+result.stderr
    # A modified player must never be silently overwritten.
    raw=target.read_bytes();target.write_bytes(raw+b'tamper');result=run()
    assert result.returncode!=0 and 'APPLICATION_DAMAGED' in result.stderr,result.stderr
    assert target.read_bytes()==raw+b'tamper'
print('PASS: 168 encrypted audio targets; one original player extended; old content preserved; input integrity, private receipts, JS parsing and repeat deployment verified.')
