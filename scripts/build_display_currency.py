#!/usr/bin/env python3
"""Add country-aware indicative prices without changing transaction currencies."""
import json,re,html
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'src/commerce'
def build(dest):
 catalog=json.loads((SRC/'products.json').read_text());words=json.loads((SRC/'display-currency-locales.json').read_text())
 base=json.loads((SRC/'locales.json').read_text());account=json.loads((SRC/'account-locales.json').read_text());extra=json.loads((SRC/'checkout-locales.json').read_text())
 for lang,translations in words.items():
  all_words={**base[lang],**account[lang],**extra[lang],**translations};t=lambda k:html.escape(all_words[k],quote=True)
  ui_words={k:all_words[k] for k in [*translations,'working','account_individual','account_family','account_institution','monthly','annual','lifetime']}
  for name in ['checkout.html','cart.html','product.html']:
   p=dest/lang/name;s=p.read_text();checkout=name!='product.html'
   payload={'words':ui_words}
   if not checkout:payload['catalog']={'products':catalog['products']}
   encoded=json.dumps(payload,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
   s=re.sub(r'<section data-display-widget.*?</section>','',s,flags=re.S)
   s=re.sub(r'<script id="display-currency-config".*?</script>','',s,flags=re.S)
   s=re.sub(r'<(?:script|link)\b[^>]*display-currency\.(?:js|css)[^>]*>(?:</script>)?','',s)
   s=re.sub(r'<div data-display-extra.*?</div>','',s,flags=re.S)
   # Keep existing billing-country field, but place it next to the global display selector.
   if checkout:
    match=re.search(r'<label class="commerce-field">[^<]*<select name="country_code".*?</select></label>',s,re.S)
    if not match:raise ValueError('Missing checkout country '+lang)
    country=match.group();s=s[:match.start()]+s[match.end():]
   else:country='<label>'+t('country')+'<select data-display-country><option value="">'+t('country')+'</option></select></label>'
   widget='<section data-display-widget class="display-currency" aria-label="'+t('display_title')+'"><h2>'+t('display_title')+'</h2><div class="display-fields">'+country+'<label>'+t('display_currency')+'<select data-display-currency disabled><option value="USD">USD</option></select></label></div><p>'+t('display_hint')+'</p>'
   if not checkout:widget+='<label class="display-offer">'+t('plans')+'<select data-display-offer></select></label><p class="display-base">USD · <strong data-display-base dir="ltr"></strong></p>'
   widget+='<div data-display-total role="status" aria-live="polite"></div><p class="display-payment-note">'+t('display_note')+'</p><p class="display-attribution"><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a></p></section>'
   if checkout:
    s=s.replace('</fieldset>','</fieldset>'+widget,1)
    for hook in ['<div data-summary-quote','<div data-review-quote']:
     s=s.replace(hook,'<div data-display-extra><div data-display-total></div><p class="display-payment-note">'+t('display_note')+'</p></div>'+hook,1)
   else:s=re.sub(r'(<div class="cta-row"><a[^>]*data-checkout-buy.*?</div>)',lambda m:m.group()+widget,s,count=1,flags=re.S)
   s=s.replace('</head>','<link rel="stylesheet" href="../display-currency.css?v=global-fx-1"/><script defer src="../display-currency.js?v=global-fx-1"></script></head>')
   # display-currency must subscribe before checkout publishes selection/quote events.
   script='<script defer src="../checkout.js?v=global-fx-1"></script>'
   s=re.sub(r'<script defer src="../checkout.js[^\"]*"></script>','',s)
   if checkout:s=s.replace('</head>',script+'</head>')
   s=s.replace('</body>','<script id="display-currency-config" type="application/json">'+encoded+'</script></body>');p.write_text(s)
 for name in ['display-currency.js','display-currency.css','display-currencies.json']:(dest/name).write_bytes((SRC/name).read_bytes())
 print('Built country-aware price display in 32 checkout, cart and product languages.')
if __name__=='__main__':build(ROOT/'dist')
