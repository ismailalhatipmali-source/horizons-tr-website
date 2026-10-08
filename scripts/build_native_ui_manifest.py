#!/usr/bin/env python3
"""Build the UI-only source manifest. Does not read hosting, keys or curriculum."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RELEASE = 'native-experiences-20261007-r1'
SOURCES = ['native-experiences.js', 'native-experiences.css', 'native-shadow.css',
           'native-locales.json', 'native-art.json', 'native-visibility.css']
CODE = ['scripts/native-ui-publication.php', 'scripts/native-ui-state.php',
        'scripts/native-ui-plan.php', 'scripts/deploy-native-ui.php',
        'scripts/workbook-focus-preservation.php', 'scripts/trial-pause-preservation.php',
        'scripts/comprehensive-meaning-preservation.php',
        'scripts/blending3-preservation.php', 'scripts/meaning-preservation.php', 'scripts/blending2-preservation.php',
        'release-assets/native-experiences-20261007-r1/predecessors/comprehensive-meaning-preservation.php',
        'scripts/blending4-preservation.php',
        'release-assets/native-experiences-20261007-r1/predecessors/blending4-preservation.php',
        'release-assets/native-experiences-20261007-r1/predecessors/blending3-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/manifest.json',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/native-ui-publication.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/native-ui-state.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/native-ui-plan.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/deploy-native-ui.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/workbook-focus-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/trial-pause-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/comprehensive-meaning-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/blending3-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/meaning-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/blending2-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/release-assets/native-experiences-20261007-r1/predecessors/comprehensive-meaning-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/scripts/blending4-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/release-assets/native-experiences-20261007-r1/predecessors/blending4-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/release-assets/native-experiences-20261007-r1/predecessors/blending3-preservation.php',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-experiences.js',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-experiences.css',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-shadow.css',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-locales.json',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-art.json',
        'release-assets/native-experiences-20261007-r1/legacy/src/workbook-experiences/native-visibility.css',
        'release-assets/native-experiences-20261007-r1/previous-single/manifest.json',
        'release-assets/native-experiences-20261007-r1/previous-single/scripts/native-ui-publication.php',
        'release-assets/native-experiences-20261007-r1/previous-single/scripts/native-ui-state.php',
        'release-assets/native-experiences-20261007-r1/previous-single/scripts/native-ui-plan.php',
        'release-assets/native-experiences-20261007-r1/previous-single/scripts/deploy-native-ui.php',
        'release-assets/native-experiences-20261007-r1/previous-single/src/workbook-experiences/native-experiences.css']
PATHS = ['try/workbook.js', 'learn/content/1.4.1/workbook.js.hzn',
         'try/demo-asset-manifest.json', 'learn/asset-manifest.json', 'try/sw.js', 'learn/sw.js']
def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()
def main() -> None:
    sources = {p: digest((ROOT / 'src/workbook-experiences' / p).read_bytes()) for p in SOURCES}
    command = ['php', '-r', 'require $argv[1]; echo hznUiAddon($argv[2], json_decode($argv[3], true, 32, JSON_THROW_ON_ERROR));',
               str(ROOT / CODE[0]), str(ROOT), json.dumps(sources)]
    addon = subprocess.run(command, check=True, capture_output=True, timeout=20).stdout
    # Check the actual compiled JavaScript, not a reconstructed stand-in.
    subprocess.run(['node', '--check', '-'], input=addon, check=True, capture_output=True, timeout=20)
    manifest = {'schema': 1, 'release': RELEASE, 'status': 'candidate-not-published',
                'paths': PATHS, 'sources': sources,
                'code': {p: digest((ROOT / p).read_bytes()) for p in CODE},
                'addon_sha256': digest(addon), 'addon_bytes': len(addon)}
    target = ROOT / 'release-assets' / RELEASE
    target.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    (target / 'manifest.json').write_bytes(data)
    (target / 'manifest.sha256').write_text(digest(data) + '\n')
    (ROOT / 'artifacts').mkdir(exist_ok=True)
    (ROOT / 'artifacts/native-ui-addon.js').write_bytes(addon)
    print(json.dumps({'release': RELEASE, 'manifest_sha256': digest(data),
                      'compiled_addon_bytes': len(addon), 'production_written': False}))
if __name__ == '__main__':
    main()
