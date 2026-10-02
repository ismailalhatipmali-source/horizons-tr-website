"""Verify creation and repair of publicly traversable preview directories."""
import os, re, shlex, stat, subprocess, tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
php = shlex.split(os.environ.get('HZN_TRAVEL_PHP', 'php'))
script = (repo / 'scripts/deploy-travel-kit.php').read_text()
languages = 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()

with tempfile.TemporaryDirectory(prefix='hzn-public-media-') as temp:
    home = Path(temp)
    scopes = {'public': home / 'public_html', 'private': home / 'horizons-checkout-review', 'delivery': home / 'horizons-travel-delivery'}
    for scope, directory in scopes.items():
        directory.mkdir(mode=0o755 if scope == 'public' else 0o700)
    for scope, source, target in re.findall(r"\['(public|private|delivery)','([^']+)','([^']+)'", script):
        source_file = repo / source
        if not source_file.is_file():
            continue
        output = scopes[scope] / target
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(source_file.read_bytes())
    private = scopes['private']
    (private / 'key.bin').write_bytes(os.urandom(32))
    (private / 'products.json').write_bytes((repo / 'src/commerce/products.json').read_bytes())
    web = scopes['public']
    for lang in languages:
        output = web / 'assets/covers' / lang / 'travel-kit.svg'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes((repo / 'dist/assets/covers' / lang / 'travel-kit.svg').read_bytes())
    def publish():
        result = subprocess.run(php + [str(repo / 'scripts/deploy-travel-kit.php'), str(web), '--publish'], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
    def verify():
        for lang in languages:
            folder = web / 'assets/travel-kit' / lang
            for directory in [folder, folder.parent, folder.parent.parent]:
                assert stat.S_IMODE(directory.stat().st_mode) == 0o755, directory
            for filename in ['proposal.jpg', 'pricing.jpg', 'itinerary.jpg', 'preview.mp4']:
                output = folder / filename
                assert stat.S_IMODE(output.stat().st_mode) == 0o644
                assert output.read_bytes() == (repo / 'dist/assets/travel-kit' / lang / filename).read_bytes()
        assert stat.S_IMODE(private.stat().st_mode) == 0o700
        assert stat.S_IMODE(scopes['delivery'].stat().st_mode) == 0o700
    publish()
    verify()
    # Reproduce the live defect while all file bytes already match.
    (web / 'assets/travel-kit').chmod(0o700)
    publish()
    verify()
print('PASS: fresh media publication and repair of restrictive parent permissions; private directories remain private.')
