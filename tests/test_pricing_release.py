#!/usr/bin/env python3
"""Check every localized offer/page against the approved price catalog and predecessor."""
import hashlib
import html
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
release=root/'release-assets/pricing-cards-20261004-r1'
marketing=json.loads((root/'release-assets/demo-marketing-20261004-r1/manifest.json').read_text())
manifest=json.loads((release/'manifest.json').read_text())
copy=json.loads((root/'src/commerce/pricing-description-locales.json').read_text())
catalog=json.loads((root/'src/commerce/products.json').read_text())['products']['horizons-arabic-level1']
sha=lambda raw:hashlib.sha256(raw).hexdigest()
assert len(manifest['files'])==100 and len(copy)==len(manifest['languages'])==32
assert set(manifest['languages'])==set(copy)
for path,entry in manifest['files'].items():
    original=(root/marketing['files'][path]['source'] if path.endswith('/product.html') else root/'dist'/path).read_bytes() if '/' in path else (root/'dist'/path).read_bytes()
    updated=(root/entry['source']).read_bytes()
    assert sha(original)==entry['before'] and sha(updated)==entry['sha256'] and len(updated)==entry['bytes']
    if path.endswith('/product.html'):
        language=path.split('/')[0]
        assert html.escape(copy[language]['description'],quote=True) in updated.decode()
        assert html.escape(copy[language]['future'],quote=True) in updated.decode()
    if path.endswith('.html'):
        output=updated.decode()
        assert output.count('display-currency.js?v=pricing-cards-20261004-r1')==1
        assert output.count('display-currency.css?v=pricing-cards-20261004-r1')==1
        if not path.endswith('/product.html'):
            assert output.count('checkout.js?v=pricing-cards-20261004-r1')==1
            assert output.count('checkout.css?v=pricing-cards-20261004-r1')==1
            config=re.search(r'<script id="checkout-config" type="application/json">(.*?)</script>',output).group(1)
            offers=json.loads(config)['catalog']['products']['horizons-arabic-level1']['offers']
            assert offers==catalog['offers']
assert '1,237' in copy['en']['description'] and '1,940' in copy['en']['description']
assert '١٬٢٣٧' in copy['ar']['description'] and '١٬٩٤٠' in copy['ar']['description']
print('PASS: 32 localized descriptions; seven catalog-backed offers; 100 exact release payloads.')
