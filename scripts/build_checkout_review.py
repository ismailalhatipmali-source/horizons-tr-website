#!/usr/bin/env python3
"""Publish a visible generic checkout in explicitly non-collecting bank-review mode."""
import html
import json
import re
from pathlib import Path
from update_contact_details import update as update_contacts

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src/commerce'
LANGS = 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
POLICIES = {'distance-sales.html':'sales_title','pre-information.html':'preinfo_title','refund-cancellation.html':'refund_title','checkout-privacy.html':'privacy_title'}
def encoded(value):
    return json.dumps(value,ensure_ascii=False).replace('<','\\u003c')
def esc(value):
    return html.escape(str(value),quote=True)

def build(dest):
    catalog=json.loads((SRC/'products.json').read_text())
    assert catalog['mode']=='bank_review' and catalog['collection_enabled'] is False and catalog['card_enabled'] is False
    base=json.loads((SRC/'locales.json').read_text());accounts=json.loads((SRC/'account-locales.json').read_text());extra=json.loads((SRC/'checkout-locales.json').read_text())
    assert set(extra)==set(LANGS) and all(set(v)==set(extra['en']) for v in extra.values())
    for currency,iban in catalog['bank_transfer']['accounts'].items():
        number=''.join(str(ord(c)-55) if c.isalpha() else c for c in iban[4:]+iban[:4]);assert int(number)%97==1
    for lang in LANGS:
        words={**base[lang],**accounts[lang],**extra[lang]}
        if lang=='tr':words['checkout']='Ödeme'
        t=lambda key:esc(words[key])
        original=(dest/lang/'product.html').read_text()
        head,rest=original.split('<main',1);foot=rest.split('</main>',1)[1]
        # The source product can contain checkout links from a prior build.
        head=re.sub(r'<(?:script|link)\b[^>]*(?:checkout\.(?:js|css)|commerce-cart\.js|location-picker\.js)[^>]*>(?:</script>)?','',head)
        foot=re.sub(r'<script id="checkout-config".*?</script>','',foot,flags=re.S)
        seller=catalog['seller']
        seller_html='<div class="checkout-seller" lang="tr" dir="ltr"><strong>'+esc(seller['name'])+'</strong><address>'+esc(seller['address'])+'</address><p>MERSİS: '+seller['mersis']+' · İstanbul Ticaret Sicil: '+seller['registry']+'<br/>VKN: '+seller['tax_number']+' · Vergi Dairesi: '+esc(seller['tax_office'])+'</p><a href="tel:'+seller['phone']+'">'+seller['phone']+'</a> · <a href="mailto:'+seller['email']+'">'+seller['email']+'</a></div>'
        links='<nav class="checkout-policy" aria-label="'+t('sales_title')+'">'+''.join('<a data-policy="'+path+'" href="'+path+'" target="_blank" rel="noopener">'+t(key)+'</a>' for path,key in POLICIES.items())+'</nav>'
        bank=catalog['bank_transfer'];bank_html='<div class="checkout-bank"><strong>VakıfBank</strong><p class="commerce-beneficiary" dir="ltr">'+esc(seller['name'])+'</p>'
        iban=lambda c:'<p><b>'+c+'</b><br/><bdi class="commerce-iban" dir="ltr">'+esc(' '.join(bank['accounts'][c][i:i+4] for i in range(0,26,4)))+'</bdi></p>'
        bank_html+=iban('TRY')+'<p>'+t('currency_note')+'</p><details><summary>USD / EUR</summary>'+iban('USD')+iban('EUR')+'</details></div>'
        def page(title,body,name,config=False):
            h=head.replace('product.html',name)
            h=re.sub(r'<title>.*?</title>','<title>HORIZONS · '+title+'</title>',h,flags=re.S)
            h=h.replace('</head>','<link rel="stylesheet" href="../checkout.css?v=20261002-1"/>'+('<script defer src="../checkout.js?v=20261002-1"></script>' if config else '')+'</head>')
            f=foot
            if config:f=f.replace('</body>','<script id="checkout-config" type="application/json">'+encoded({'catalog':catalog,'words':words})+'</script></body>')
            return h+body+f
        def field(key,kind='text',required=True,limit=160,attrs=''):
            auto={'first_name':'given-name','last_name':'family-name','phone':'tel','email':'email','address':'street-address','postal':'postal-code','city':'address-level2','company_name':'organization'}.get(key,'off')
            return '<label class="commerce-field">'+t(key)+'<input name="'+key+'" type="'+kind+'" maxlength="'+str(limit)+'" autocomplete="'+auto+'"'+(' required' if required else '')+' '+attrs+'/></label>'
        main='<main class="commerce-main" data-checkout id="main"><div class="checkout-hero"><div><span class="checkout-kicker">HORIZONS</span><h1 class="commerce-title">'+t('checkout')+'</h1></div><span class="checkout-step">VakıfBank Sanal POS</span></div><div class="commerce-notice" role="note">'+t('review_note')+'</div><div class="commerce-grid"><section class="commerce-panel"><form data-buyer-form>'
        main+='<fieldset class="checkout-section"><legend>'+t('product')+'</legend><div class="commerce-fields"><label class="commerce-field">'+t('product')+'<select name="product" required></select></label><label class="commerce-field">'+t('plans')+'<select name="offer" required></select></label></div></fieldset>'
        main+='<fieldset class="checkout-section"><legend>'+t('billing')+'</legend><div class="commerce-fields">'+field('first_name',limit=100)+field('last_name',limit=100)+field('email','email',limit=254)+field('email_confirm','email',limit=254)+field('phone','tel',limit=40,attrs='minlength="7"')
        main+='<label class="commerce-field">'+t('country')+'<select name="country_code" required autocomplete="country"><option value="">'+t('country')+'</option></select></label>'+field('city',limit=100,attrs='list="commerce-cities"')+'<datalist id="commerce-cities"></datalist>'+field('address',limit=500)+field('postal',required=False,limit=32)
        main+='<label class="commerce-field">'+t('billing')+'<select name="billing"><option value="individual">'+t('individual')+'</option><option value="company">'+t('company')+'</option></select></label><div class="commerce-fields commerce-company" data-company hidden>'+field('company_name',required=False,limit=200)+field('tax_number',required=False,limit=11,attrs='inputmode="numeric" pattern="[0-9]{10,11}"').replace('name="tax_number"','name="tax_id"')+field('tax_office',required=False,limit=100)+'</div></div></fieldset>'
        main+='<fieldset class="commerce-methods checkout-section"><legend>'+t('payment')+'</legend><label><input type="radio" name="method" value="transfer" checked/><span class="checkout-method-label">Havale / EFT / FAST<small>Türkiye · TRY</small></span></label><label><input type="radio" name="method" value="card"/><span class="checkout-method-label">'+t('card_title')+'<small>VakıfBank Sanal POS · '+t('unavailable')+'</small></span></label></fieldset><div data-card-panel class="checkout-notice" hidden>'+t('card_note')+'</div><div data-transfer-panel class="checkout-notice"><p>'+t('turkey_only')+'</p><p>'+t('currency_note')+'</p></div><p data-country-note class="commerce-small">'+t('turkey_only')+'</p>'
        main+=links+'<div class="checkout-notice">'+t('data_note')+'</div><label class="commerce-consent"><input name="consent" type="checkbox" required/><span>'+t('terms_consent')+'</span></label><label class="commerce-consent"><input name="privacy" type="checkbox" required/><span>'+t('privacy_consent')+'</span></label><p class="commerce-email-warning" data-email-warning>'+t('permanent_warning')+'</p><label class="commerce-consent"><input type="checkbox" name="permanent" required/><span>'+t('permanent_consent')+'</span></label><button class="button" type="submit">'+t('review_order')+'</button></form>'
        main+='<section data-checkout-review id="checkout-review" tabindex="-1" hidden><h2>'+t('review_order')+'</h2><dl id="buyer-summary" data-buyer-summary data-review-fields></dl><h3>'+t('payment')+'</h3><p data-review-method></p><p data-review-card class="checkout-notice" hidden>'+t('card_note')+'</p><p data-review-country class="checkout-notice" hidden>'+t('turkey_only')+'</p><p class="checkout-notice">'+t('review_note')+'</p><div class="checkout-actions"><button type="button" class="button" data-final-submit>'+t('submit_review')+'</button><button type="button" class="button ghost" data-edit>'+t('edit')+'</button></div><div data-receipt tabindex="-1" hidden><p class="checkout-review-only">'+t('pending')+'</p><h3>'+t('reference')+'</h3><p class="checkout-reference" data-reference></p><p>'+t('reference_note')+'</p><button type="button" class="button ghost checkout-print" data-print>'+t('print')+'</button></div></section><p class="checkout-status" role="status" aria-live="polite" data-checkout-status></p></section>'
        main+='<aside class="commerce-panel checkout-summary"><div class="commerce-item"><img data-product-image src="'+esc(next(iter(catalog['products'].values()))['image'])+'" width="2048" height="1143" alt=""/><div><h2 data-product-name></h2><p data-offer-name></p></div></div><p class="commerce-small" data-product-facts></p><div class="commerce-total"><span>'+t('total')+'</span><strong data-total></strong></div><p>'+t('indicative')+'</p><p class="commerce-small">'+t('billing_note')+'</p>'+bank_html+links+seller_html+'</aside></div></main>'
        for name in ['checkout.html','cart.html']:(dest/lang/name).write_text(page(t('checkout'),main,name,True))
        # Reuse the site's existing translated consumer-rights clauses without
        # converting a non-payable review form into a completed sales agreement.
        terms=(dest/lang/'terms.html').read_text().split('<article>',1)[1].split('</article>',1)[0]
        paragraphs=re.findall(r'<p>.*?</p>',terms.split('<div class="contact-card">',1)[0],re.S)
        right_paragraphs=paragraphs[5:]
        if len(right_paragraphs)<2:raise ValueError('Consumer rights missing: '+lang)
        rights=''.join(right_paragraphs[:3])
        table='<table><thead><tr><th>'+t('product')+'</th><th>'+t('plans')+'</th><th>'+t('total')+'</th></tr></thead><tbody>'
        for p in catalog['products'].values():
            if not p['available']:continue
            for o in p['offers']:
                offer_name=words.get('account_'+o.get('account_type',''),o['id'])+' · '+words.get(o.get('term',''),o.get('term',''))
                table+='<tr><td>'+esc(p['name'])+'</td><td>'+esc(offer_name)+'</td><td><bdi>'+f'{o["price_minor"]/100:,.2f} '+o['currency']+'</bdi></td></tr>'
        table+='</tbody></table><p>'+t('indicative')+' · '+t('billing_note')+'</p>'
        bodies={
          'pre-information.html':seller_html+'<h2>'+t('product')+'</h2>'+table+'<p>'+t('delivery_note')+'</p><p>'+t('updates_note')+'</p><h2>'+t('payment')+'</h2><p>'+t('currency_note')+'</p><p>'+t('card_note')+'</p><h2>'+t('refund_title')+'</h2>'+rights,
          'distance-sales.html':seller_html+'<h2>'+t('product')+'</h2>'+table+'<p>'+t('delivery_note')+'</p><p>'+t('access_note')+'</p><p>'+t('permanent_warning')+'</p><p>'+t('institution_note')+'</p><h2>'+t('payment')+'</h2><p>'+t('currency_note')+'</p><p>'+t('reference_note')+'</p><p>'+t('card_note')+'</p><h2>'+t('refund_title')+'</h2>'+rights,
          'refund-cancellation.html':seller_html+rights+'<p><a href="mailto:support@horizons-tr.com">support@horizons-tr.com</a> · <a href="tel:+905522268840">+90 552 226 88 40</a></p>',
          'checkout-privacy.html':seller_html+'<h2>'+t('privacy_title')+'</h2><p>'+t('data_note')+'</p><p>'+t('card_note')+'</p><p><a href="privacy.html">'+t('privacy_title')+'</a> · <a href="mailto:privacy@horizons-tr.com">privacy@horizons-tr.com</a></p>'
        }
        # Include the existing translated sharing, retention and KVKK rights text.
        privacy=(dest/lang/'privacy.html').read_text().split('<article>',1)[1].split('</article>',1)[0]
        sections=re.findall(r'<section>.*?</section>',privacy,re.S)
        if len(sections)<4:raise ValueError('Privacy clauses missing: '+lang)
        # Reuse translated processing grounds, hosting/recipient/retention clauses
        # and statutory rights. Leave workbook-specific profile claims out.
        grounds=re.findall(r'<p>.*?</p>',sections[1],re.S)[0]
        bodies['checkout-privacy.html']+=grounds+sections[2]+sections[3]
        for name,key in POLICIES.items():
            body='<main class="legal checkout-legal checkout-policy-page" id="main"><article><p class="date">2026-10-02</p><h1>'+t(key)+'</h1><p class="checkout-notice">'+t('review_note')+'</p>'+bodies[name]+links+'<p><a class="button" href="checkout.html">'+t('checkout')+'</a></p></article></main>'
            (dest/lang/name).write_text(page(t(key),body,name))
        for name in ['index.html','product.html']:
            path=dest/lang/name;s=path.read_text();s=re.sub(r'<a[^>]*data-checkout-buy[^>]*>.*?</a>','',s,flags=re.S)
            link='<a class="button" data-checkout-buy href="checkout.html?product=horizons-arabic-level1">'+t('buy_now')+'</a>'
            if name=='index.html':
                match=re.search(r'<article\b[^>]*id="arabic".*?</article>',s,re.S)
                if not match:raise ValueError('Available product card missing')
                card=match.group().replace('</article>','<div class="cta-row">'+link+'</div></article>');s=s[:match.start()]+card+s[match.end():]
            else:s=re.sub(r'(<h1>.*?</h1>\s*<p>.*?</p>)',lambda m:m.group()+'<div class="cta-row">'+link+'</div>',s,count=1,flags=re.S)
            path.write_text(s)
        for path in (dest/lang).glob('*.html'):
            s=path.read_text().replace('site-commerce.js?v=accounts-3','site-commerce.js?v=checkout-20261002')
            path.write_text(s)
    for name in ['checkout.js','checkout.css','site-commerce.js','products.json']:(dest/name).write_bytes((SRC/name).read_bytes())
    for name in ['checkout.html','cart.html']:
        language_links=' '.join('<a href="'+lang+'/checkout.html" lang="'+lang+'">'+lang+'</a>' for lang in LANGS)
        entry='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HORIZONS · Checkout / Ödeme</title><body><h1>HORIZONS · Checkout / Ödeme</h1><nav>'+language_links+'</nav><script>'
        entry+='(()=>{const langs='+encoded(LANGS)+';const u=new URL(location.href);const lang=[u.searchParams.get("lang"),...(navigator.languages||[navigator.language])].filter(Boolean).map(x=>x.toLowerCase().split("-")[0]).map(x=>["nb","nn"].includes(x)?"no":x).find(x=>langs.includes(x))||"en";const q=new URLSearchParams();for(const key of ["product","offer","account","plan"]){const v=u.searchParams.get(key);if(v&&/^[a-z0-9-]{1,100}$/.test(v))q.set(key,v);}location.replace(lang+"/checkout.html"+(q.size?"?"+q.toString():""));})();'
        (dest/name).write_text(entry+'</script></body></html>')
    update_contacts(dest)
    print('Built 32 checkout languages, 128 linked policy pages, and generic product metadata. Collection disabled.')

if __name__=='__main__':build(ROOT/'dist')
