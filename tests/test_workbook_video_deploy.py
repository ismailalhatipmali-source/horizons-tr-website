"""Verify publication, public traversal, idempotency and rejection of unverified media."""
import hashlib,json,os,shlex,shutil,stat,subprocess,tempfile
from pathlib import Path
repo=Path(__file__).resolve().parents[1];php=shlex.split(os.environ.get('HZN_WORKBOOK_PHP','php'));manifest=json.loads((repo/'release-assets/workbook-videos-1.0.0/manifest.json').read_text())
with tempfile.TemporaryDirectory(prefix='hzn-workbook-video-') as temp:
 home=Path(temp);web=home/'public_html';web.mkdir();private=home/'horizons-travel-delivery';private.mkdir(mode=0o700);secret=private/'sentinel';secret.write_bytes(b'private paid product stays private');secret.chmod(0o600)
 def publish():return subprocess.run(php+[str(repo/'scripts/deploy-workbook-videos.php'),str(web),'--publish'],capture_output=True,text=True)
 r=publish();assert r.returncode==0,r.stderr
 def verify():
  for p,e in manifest['files'].items():
   f=web/p;assert hashlib.sha256(f.read_bytes()).hexdigest()==e['sha256'];assert stat.S_IMODE(f.stat().st_mode)==0o644
   d=f.parent
   while d!=web:assert stat.S_IMODE(d.stat().st_mode)==0o755;d=d.parent
  assert stat.S_IMODE(private.stat().st_mode)==0o700;assert stat.S_IMODE(secret.stat().st_mode)==0o600;assert secret.read_bytes()==b'private paid product stays private'
 verify();(web/'assets/workbook-video').chmod(0o700);r=publish();assert r.returncode==0,r.stderr;verify()
 before=(web/'assets/workbook-video/1.0.0/ar/walkthrough.mp4').read_bytes();collision=web/'workbook-video.css';collision.write_text('unexpected edit');r=publish();assert r.returncode==1 and 'PUBLIC_BASELINE_CHANGED' in r.stderr;assert collision.read_text()=='unexpected edit';assert (web/'assets/workbook-video/1.0.0/ar/walkthrough.mp4').read_bytes()==before
print('PASS: 98 verified media files, public parent permissions, private ZIP permissions, idempotency and safe refusal of changed baselines.')
