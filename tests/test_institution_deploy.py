import hashlib,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=json.loads((ROOT/'release-assets/institution-20261003/manifest.json').read_text())
PHP=os.environ.get('HZN_TEST_PHP','php')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(prefix='hzn-institution-') as t:
    home=Path(t);web=home/'public_html';web.mkdir()
    app=home/'license/app';app.mkdir(parents=True);commerce=home/'license/commerce';commerce.mkdir()
    private=home/'horizons-checkout-review';private.mkdir();(private/'key.bin').write_bytes(os.urandom(32))
    config=home/'config.php';config.write_text('<?php return '+"['code_path'=>"+json.dumps(str(app))+'];')
    (web/'activation').mkdir();(web/'activation/config-path.php').write_text('<?php return '+json.dumps(str(config))+';')
    roots={'public':web,'commerce':commerce,'private':private}
    def target(path):a,b=path.split('/',1);return roots[a]/b
    for path,e in M['files'].items():
        source=e['source']
        if path.startswith('public/learn/'):
            source='src/workbook-web/'+path.split('/')[-1] if not path.endswith('asset-manifest.json') else 'release-assets/1.4.5/files/learn/asset-manifest.json'
        prior=subprocess.check_output(['git','show','9b67ccfcd8efc10e32d1cb876871e880fcebf2b8:'+source],cwd=ROOT)
        p=target(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(prior);assert sha(p)==e['before'],path
    sentinel=home/'license/activation.sqlite';sentinel.write_bytes(b'preserve-private-data');sentinel.chmod(0o600)
    def run(publish=True):return subprocess.run([PHP,str(ROOT/'scripts/deploy-institution.php'),str(web)]+(['--publish'] if publish else []),capture_output=True,text=True)
    p=commerce/'MembershipLedger.php';prior=p.read_bytes();p.write_bytes(prior+b'local-edit')
    r=run();assert r.returncode==1 and 'PUBLIC_BASELINE_CHANGED' in r.stderr,r.stderr
    assert target('public/ar/product.html').read_bytes()!= (ROOT/'dist/ar/product.html').read_bytes()
    p.write_bytes(prior);r=run(False);assert r.returncode==0 and 'READY' in r.stdout,r.stderr
    r=run();assert r.returncode==0 and 'PUBLISHED' in r.stdout,r.stderr
    for path,e in M['files'].items():assert sha(target(path))==e['sha256'],path
    for path in ['commerce/MembershipLedger.php','commerce/PurchaseLedger.php','private/products.json']:assert target(path).stat().st_mode&0o777==0o600
    assert target('public/learn/web-config.js').stat().st_mode&0o777==0o644
    r=run();assert r.returncode==0 and 'CURRENT' in r.stdout,r.stderr
    assert sentinel.read_bytes()==b'preserve-private-data' and sentinel.stat().st_mode&0o777==0o600
    backup=list((home/'.horizons-deploy-public_html').glob('institution-backup-*'));assert len(backup)==1
    assert all(sha(backup[0]/path)==e['before'] for path,e in M['files'].items())
    assert not list(home.rglob('*.hzn-new-*'))
print('PASS: 205 exact institution targets, private permissions/data preserved, conflicting edits rejected before publication, rollback copies verified, idempotent repeat.')
