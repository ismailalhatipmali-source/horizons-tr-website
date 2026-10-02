#!/usr/bin/env python3
"""Derive current tender currencies from pinned Unicode CLDR 48 (Unicode license)."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def build(as_of='2026-10-02'):
 data=json.loads((ROOT/'src/commerce/vendor/cldr-currencyData-48.json').read_text())['supplemental']['currencyData']
 countries=json.loads((ROOT/'dist/assets/commerce-geo/countries.json').read_text())
 regions={}
 for row in countries:
  regions[row['code']]=list(dict.fromkeys(code for item in data['region'].get(row['code'],[]) for code,v in item.items() if v.get('_tender')!='false' and v.get('_from','0000')<=as_of and v.get('_to','9999')>as_of))
 currencies={code:{'digits':int(data['fractions'].get(code,data['fractions']['DEFAULT'])['_digits'])} for code in sorted({code for v in regions.values() for code in v})}
 output={'schema':1,'source':'Unicode CLDR 48','as_of':as_of,'countries':regions,'currencies':currencies}
 (ROOT/'src/commerce/display-currencies.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
 print(len(regions),'countries;',len(currencies),'current currencies')
if __name__=='__main__':build()
