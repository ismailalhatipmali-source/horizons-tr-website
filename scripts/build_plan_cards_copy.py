#!/usr/bin/env python3
"""Build the two shared pricing interfaces from the current licensed offer catalog."""
import json
import shutil
from pathlib import Path

root=Path(__file__).resolve().parents[1]
src=root/'src/commerce'
dist=root/'release-assets/pricing-cards-20261004-r1/files'
dist.mkdir(parents=True,exist_ok=True)
locales=json.loads((src/'account-locales.json').read_text())
keys=('count_individual','count_family','count_institution','learner_login','updates_note','permanent_warning','institution_note')
copy={locale:{key:values[key] for key in keys} for locale,values in locales.items()}
assert len(copy)==32 and all(set(v)==set(keys) for v in copy.values())
catalog=json.loads((src/'products.json').read_text())['products']['horizons-arabic-level1']
assert {(o['account_type'],o['term'],o['price_minor'],o['max_learners']) for o in catalog['offers']}=={
 ('individual','monthly',999,1),('individual','annual',9900,1),('individual','lifetime',15000,1),
 ('family','monthly',2000,5),('family','annual',20000,5),('family','lifetime',25000,5),
 ('institution','annual',100000,500)}
for name in ('checkout.js','checkout.css'):
    shutil.copyfile(src/name,dist/name)
(dist/'display-currency.css').write_text((src/'display-currency.css').read_text()+'\n'+(src/'plan-cards-product.css').read_text())
template=(src/'display-currency.js').read_text()
serialized=json.dumps(copy,ensure_ascii=False,separators=(',',':'))
assert template.count(serialized)==1
(dist/'display-currency.js').write_text(template)
print('Built four plan-card assets with seven existing offers and 32 localized descriptions.')
