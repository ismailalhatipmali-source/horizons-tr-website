#!/usr/bin/env python3
"""Rebuild the public ODbL country/city suggestions from a pinned revision."""
import json,urllib.request,pathlib,concurrent.futures,hashlib
p=pathlib.Path(__file__).resolve().parents[1]/'dist/assets/commerce-geo';p.mkdir(parents=True,exist_ok=True)
sha='54ab470dae7d13d3af505c9e0217d5d1e3f1cce0';base=f'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/{sha}/'
countries=json.load(urllib.request.urlopen(base+'json/countries.json'))
(p/'countries.json').write_text(json.dumps([{'code':c['iso2'],'name':c['name']} for c in countries],ensure_ascii=False,separators=(',',':'))+'\n')
def build(c):
 code=c['iso2']
 try:
  data=json.load(urllib.request.urlopen(base+'contributions/cities/'+code+'.json',timeout=60))
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
  data=[]
 # City labels only: no coordinates, timezone or population tracking.
 vals={}
 for x in data:
  name=x['name'];ar=(x.get('translations') or {}).get('ar')
  vals[name]=[name,ar] if isinstance(ar,str) and ar!=name else [name]
 out=sorted(vals.values(),key=lambda x:x[0].casefold())
 (p/(code+'.json')).write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
 return len(out)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as e:counts=list(e.map(build,countries))
(p/'LICENSE.txt').write_bytes(urllib.request.urlopen(base+'LICENSE').read())
(p/'README.txt').write_text(f'Contains information from Countries States Cities Database, made available under the Open Database License (ODbL) v1.0.\nSource: https://github.com/dr5hn/countries-states-cities-database\nPinned revision: {sha}\nDerived files: country code/name and city name/Arabic label only, split by country.\nThese derived data files remain freely available under ODbL 1.0. No API key or geolocation is used. Coverage is not guaranteed; manual city entry remains available.\n')
print('Built',len(countries),'countries and',sum(counts),'city labels; bytes',sum(f.stat().st_size for f in p.iterdir()))
