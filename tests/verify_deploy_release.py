"""Run a real release into a NEW isolated directory and compare published bytes.

Developer verification only. cPanel itself runs the Bash deploy script without Python.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import zipfile

def digest(path):
    with path.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--artifacts', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    repo, originals, output = args.repo.resolve(), args.artifacts.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    target = output / 'public_html'; target.mkdir()
    sentinels = {
        'activation/config.php': 'ISOLATED_SMTP_CONFIG_SENTINEL',
        'activation/data/registry.sqlite': 'ISOLATED_ACTIVATION_STATE',
        'downloads/unrelated-product.zip': 'UNRELATED_DOWNLOAD',
        '.user.ini': 'HOST_PHP_SETTINGS', 'php.ini': 'HOST_PHP_INI',
        '.well-known/host-proof': 'HOST_CHALLENGE',
        'learn/content/1.3.0/retained.hzn': 'PRIOR_ENCRYPTED_VERSION',
    }
    for name, text in {**sentinels, 'try/stale-extra.txt': 'OLD_CHAPTER_TO_REMOVE', '.htaccess': 'HOST_RULE_BEFORE\n# BEGIN HORIZONS MANAGED\nOLD_MANAGED\n# END HORIZONS MANAGED\nHOST_RULE_AFTER\n'}.items():
        p = target / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)
    before = {n:digest(target/n) for n in sentinels}
    with (output/'deploy.log').open('w') as log:
        subprocess.run(['bash', str(repo/'scripts/deploy-cpanel.sh'), str(target)], check=True, stdout=log, stderr=subprocess.STDOUT)
    records = {}
    for line in (repo/'release-assets/1.4.0/manifest.tsv').read_text().splitlines()[1:]:
        kind, name, size, sha, parts = line.split('\t')
        records[kind] = {'filename':name, 'bytes':int(size), 'sha256':sha, 'parts':int(parts)}
    counts = {}
    for kind in ['learn', 'demo', 'update']:
        count = 0
        with zipfile.ZipFile(originals/records[kind]['filename']) as z:
            for entry in z.infolist():
                if entry.is_dir(): continue
                destination = target/entry.filename
                assert destination.is_file() and destination.stat().st_size == entry.file_size, entry.filename
                with z.open(entry) as f: expected = hashlib.file_digest(f, 'sha256').hexdigest()
                assert digest(destination) == expected, entry.filename
                count += 1
        counts[kind] = count
    setup = target/'downloads'/records['setup']['filename']
    assert setup.stat().st_size == records['setup']['bytes'] and digest(setup) == records['setup']['sha256']
    for name, expected in before.items(): assert digest(target/name) == expected, name
    assert not (target/'try/stale-extra.txt').exists()
    access = (target/'.htaccess').read_text()
    assert 'HOST_RULE_BEFORE\n' in access and 'HOST_RULE_AFTER\n' in access
    assert 'OLD_MANAGED' not in access and access.count('# BEGIN HORIZONS MANAGED') == 1
    assert digest(target/'index.html') == digest(repo/'dist/index.html')
    backups = list((output/'.horizons-deploy-public_html').glob('backup-*'))
    assert any((p/'try/stale-extra.txt').exists() for p in backups)
    report = {
        'result':'passed', 'version':'1.4.0', 'production_deployed':False,
        'script_sha256':digest(repo/'scripts/deploy-cpanel.sh'),
        'total_chunks':sum(r['parts'] for r in records.values()),
        'artifact_bytes':sum(r['bytes'] for r in records.values()),
        'published_archive_files_hash_verified':counts,
        'setup_sha256_verified':True, 'sentinels_preserved':list(sentinels),
        'old_demo_removed':True, 'old_demo_backup_outside_public_root':True,
        'old_content_version_retained':True, 'host_apache_rules_preserved':True,
        'website_index_verified':True,
    }
    (output/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__': main()
