#!/usr/bin/env python3
"""Build the scoped /learn trial-pause overlay from immutable release baselines."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = "trial-pause-20261005-r1"
BASE = ROOT / "release-assets"
OUT = BASE / RELEASE
COPY = ROOT / "src/trial-pause/portal-copy.json"
PATHS = ("learn/index.html", "learn/web-locales.json", "learn/sw.js")
SOURCES = {
    "learn/index.html": BASE / "demo-experience-20261004-r1/files/learn/index.html",
    "learn/web-locales.json": BASE / "1.4.6/files/learn/web-locales.json",
    "learn/sw.js": BASE / "demo-experience-20261004-r1/files/learn/sw.js",
}
FOCUS_WORKER_SHA = "951593ecb7ea7dcaa95bb6fd78fd61ccc86cf075ea0cb96434617686a1b97bc5"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def once(text, old, new):
    if text.count(old) != 1 or old == new:
        raise ValueError(f"expected one exact replacement: {old[:80]}")
    return text.replace(old, new)


def make_worker():
    worker = SOURCES["learn/sw.js"].read_text()
    first = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';"
    second = first[:-2] + "-comprehensive-meaning-20261004-r1';"
    third = second[:-2] + "-blending4-20261004-r1';"
    focus = third[:-2] + "-workbook-focus-20261005-r1';"
    for previous, next_value in ((first, second), (second, third), (third, focus)):
        worker = once(worker, previous, next_value)
    if sha(worker.encode()) != FOCUS_WORKER_SHA:
        raise ValueError("current hosted worker baseline changed")
    return worker, once(worker, focus, focus[:-2] + f"-{RELEASE}';")


def main():
    copy = json.loads(COPY.read_text())
    baseline_locales = json.loads(SOURCES["learn/web-locales.json"].read_text())
    if set(copy) != set(baseline_locales) or len(copy) != 32:
        raise ValueError("locale set changed")
    for code, values in copy.items():
        if set(values) != {"accessTitle", "trialNote", "pilotFull"}:
            raise ValueError(f"invalid overlay keys: {code}")
        for key, value in values.items():
            if not isinstance(value, str) or not value.strip() or any(c in value for c in "<>\n\r"):
                raise ValueError(f"invalid value: {code}/{key}")
            baseline_locales[code][key] = value
    old_index = SOURCES["learn/index.html"].read_text()
    index = old_index
    old_ar = json.loads(SOURCES["learn/web-locales.json"].read_text())["ar"]
    for key, tag in (("accessTitle", "h2"), ("trialNote", "p")):
        index = once(index, f'<{tag} data-w="{key}">{old_ar[key]}</{tag}>',
                     f'<{tag} data-w="{key}">{copy["ar"][key]}</{tag}>')
    before_worker, after_worker = make_worker()
    originals = {
        "learn/index.html": SOURCES["learn/index.html"].read_bytes(),
        "learn/web-locales.json": SOURCES["learn/web-locales.json"].read_bytes(),
        "learn/sw.js": before_worker.encode(),
    }
    result = {
        "learn/index.html": index.encode(),
        "learn/web-locales.json": (json.dumps(baseline_locales, ensure_ascii=False, indent=2) + "\n").encode(),
        "learn/sw.js": after_worker.encode(),
    }
    if sha(originals["learn/sw.js"]) != FOCUS_WORKER_SHA:
        raise ValueError("worker baseline mismatch")
    manifest = {
        "schema": 1, "release": RELEASE,
        "copy_source": {"path": "src/trial-pause/portal-copy.json", "sha256": sha(COPY.read_bytes())},
        "files": {name: {"before": sha(originals[name]), "sha256": sha(result[name]), "bytes": len(result[name]), "source": f"release-assets/{RELEASE}/files/{name}"} for name in PATHS},
    }
    for name, data in result.items():
        path = OUT / "files" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    raw = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    (OUT / "manifest.json").write_bytes(raw)
    (OUT / "manifest.sha256").write_text(sha(raw) + "\n")
    print(f"READY: {RELEASE}; three /learn shell files; 32 languages; encrypted content untouched")


if __name__ == "__main__":
    main()
