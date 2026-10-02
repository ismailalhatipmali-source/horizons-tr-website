#!/usr/bin/env python3
"""Normalize the owner's public phone and three contact roles in every locale."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHONE = '+905522268840'
EMAILS = ('info@horizons-tr.com', 'support@horizons-tr.com', 'privacy@horizons-tr.com')

def update(dest):
    labels = json.loads((ROOT / 'src/commerce/contact-locales.json').read_text())
    assert len(labels) == 32 and all(len(v) == 3 and all(v) for v in labels.values())
    changed = []
    for path in sorted(dest.glob('*/*.html')):
        lang = path.parent.name
        if lang not in labels:
            continue
        original = path.read_text()
        text = original.replace('+905522268841', PHONE).replace('+90 552 226 88 41', '+90 552 226 88 40')
        card = '<div class="contact-card">' + ''.join(
            f'<p>{html.escape(label)}</p><a class="" dir="ltr" href="mailto:{email}">{email}</a>'
            for label, email in zip(labels[lang], EMAILS)
        ) + '</div>'
        text = re.sub(r'<div class="contact-card">.*?</div>', lambda _: card, text, flags=re.S)
        if text != original:
            path.write_text(text)
            changed.append(path.relative_to(dest).as_posix())
    return changed

if __name__ == '__main__':
    print(f'Updated {len(update(ROOT / "dist"))} public pages.')
