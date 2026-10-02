#!/usr/bin/env python3
"""Build public product descriptions from the verified localized editions."""
import json,sys,zipfile
from pathlib import Path
from lxml import etree
from build_travel_kit import LANGS,REPO
root=Path(sys.argv[1]);orders=json.loads((REPO/'dist/manual-order-locales.json').read_text());overrides=json.loads((REPO/'src/travel-kit/i18n/guide-overrides.json').read_text())
en=[s for s in (root/'Agency_Kit_EN/START_HERE.txt').read_text().splitlines() if s.strip()]
# Paragraph positions follow the original source kit.
from build_travel_kit import sources
src=sources('source-master.txt',r'^<<<HZN(\d+)>>> (.*)$')
# English guide count was already updated; all paragraph positions are stable.
original=[s for s in (root.parent/'travel-kit-original/Agency_Kit_EN/START_HERE.txt').read_text().splitlines() if s.strip()]
locales={}
for lang in LANGS:
 folder=root/('Agency_Kit_'+lang.upper());guide=[s for s in (folder/'START_HERE.txt').read_text().splitlines() if s.strip()]
 index=(folder/'Document_Index.txt').read_text().splitlines();license=(folder/'License.txt').read_text().splitlines()
 def g(key):return guide[original.index(src[key])]
 z=zipfile.ZipFile(folder/'Operations_Example.xlsx');w=etree.fromstring(z.read('xl/workbook.xml'))
 sheets=[s.get('name') for s in w.findall('.//{*}sheet')]
 emails=(folder/'Email_Scripts.txt').read_text().splitlines()
 subjects=[s for s in emails if s[:2].isdigit()][:4]
 # Native headings are reused from the existing checkout translations.
 t=orders[lang]
 locales[lang]={'back-link':t['product'],'f1t':t['feature_documents'],'f1d':' · '.join(index[i].split('—',1)[-1].strip() for i in [3,8,10,14,17,22,33,35]),'f2t':t['feature_workbook'],'f2d':' · '.join(sheets),'f3t':t['feature_emails'],'f3d':' · '.join(s.split(':',1)[-1].strip() for s in subjects),'f4t':'HTML · PDF · XLSX · TXT','f4d':overrides[lang]['0447'],'s1':g('0427'),'s2':g('0428'),'s3':g('0430'),'s4':g('0432'),'lic-copy':'\n\n'.join(license[1:4]),'checkout-note':t['order_note'],'release_verified':overrides[lang]['0426']}
(REPO/'dist/travel-kit-locales.json').write_text(json.dumps(locales,ensure_ascii=False,indent=2)+'\n')
print('Built storefront descriptions:',len(locales))
