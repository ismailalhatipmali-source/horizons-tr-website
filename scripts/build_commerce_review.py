#!/usr/bin/env python3
"""Create only non-collecting review pages; never activate a live checkout."""
import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
SRC = ROOT / 'src/commerce'


def build(dest):
    catalog = json.loads((SRC / 'catalog.json').read_text())
    if catalog['mode'] != 'review' or catalog['charges_enabled'] is not False:
        raise ValueError('This builder supports review only; use an audited payment service for live checkout.')
    transfer = catalog.get('bank_transfer', {})
    accounts = transfer.get('accounts', {})
    for currency, iban in accounts.items():
        if currency not in ('TRY', 'USD', 'EUR') or not re.fullmatch(r'TR[0-9]{24}', iban):
            raise ValueError('Invalid corporate transfer account')
        digits = ''.join(str(ord(c)-55) if c.isalpha() else c for c in iban[4:] + iban[:4])
        if int(digits) % 97 != 1:
            raise ValueError('Invalid IBAN checksum')
    bank_details = '<div class="commerce-bank-accounts"><p>' + html.escape(transfer.get('bank', '')) + '</p><p class="commerce-beneficiary">' + html.escape(transfer.get('beneficiary', '')) + '</p>'
    for currency, iban in accounts.items():
        grouped = ' '.join(iban[i:i+4] for i in range(0,len(iban),4))
        bank_details += '<p data-account="' + currency + '"><b>' + currency + '</b><br/><span dir="ltr" class="commerce-iban">' + grouped + '</span></p>'
    bank_details += '</div>'
    labels = json.loads((SRC / 'locales.json').read_text())
    account_labels = json.loads((SRC / 'account-locales.json').read_text())
    for lang in LANGS:
        data = labels[lang]
        if set(data) != set(labels['en']) or any(not isinstance(x, str) or not x.strip() for x in data.values()):
            raise ValueError(f'Incomplete commerce locale: {lang}')
        data = {**data, **account_labels[lang]}
        t = lambda key: html.escape(data[key])
        original = (dest / lang / 'product.html').read_text()
        # Reuse the original branding, native-script fonts, navigation and legal links.
        before, tail = original.split('<main', 1)
        after = tail.split('</main>', 1)[1]
        after = re.sub(r'<script id="horizons-web-first-1-4">.*?</script>', '', after, flags=re.S)
        policies = []
        for name in ('terms', 'privacy', 'legal'):
            match = re.search(r'<a\b[^>]*href="' + name + r'\.html"[^>]*>.*?</a>', after)
            if not match:
                raise ValueError(f'Missing policy link: {lang}/{name}')
            policies.append(match.group())
        # Keep the seller's actual details and statutory-rights information in
        # the order review. Do not invent a separate seller or refund policy.
        terms_path = dest / lang / 'terms.html'
        terms_html = terms_path.read_text()
        headings = list(re.finditer(r'<h2>.*?</h2>', terms_html))
        if len(headings) < 2:
            raise ValueError(f'Missing licence terms: {lang}')
        start = headings[1].end()
        licence = f'<!-- commerce-licence --><p>{t("access_note")}</p><p>{t("delivery_note")}</p><p>{t("after_note")}</p><!-- /commerce-licence -->'
        if '<!-- commerce-licence -->' in terms_html:
            terms_html = re.sub(r'<!-- commerce-licence -->.*?<!-- /commerce-licence -->', lambda _: licence, terms_html, count=1, flags=re.S)
        else:
            paragraph = re.match(r'<p>.*?</p>', terms_html[start:], re.S)
            if not paragraph:
                raise ValueError(f'Missing licence paragraph: {lang}')
            terms_html = terms_html[:start] + licence + terms_html[start + paragraph.end():]
        terms_html = re.sub(r'<p class="date">.*?</p>', '<p class="date">2026-10-01</p>', terms_html, count=1)
        terms_path.write_text(terms_html)
        terms_article = terms_html.split('<article>', 1)[1].split('</article>', 1)[0]
        terms_article = re.sub(r'<div class="legal-nav">.*?</div>|<p class="date">.*?</p>|<h1>.*?</h1>', '', terms_article, flags=re.S)
        terms_title = html.escape(html.unescape(re.sub(r'<[^>]+>', '', policies[0])))
        facts = f'<div class="commerce-facts"><span>28 {t("lessons")}</span><span>560 {t("cards")}</span><span>56 {t("stories")}</span></div>'
        plan_labels = ''.join(f'<span data-selected-plan="{p}" hidden>{t(p)}</span>' for p in catalog['plans'])
        item = f'<div class="commerce-item"><img src="../assets/covers/{lang}/arabic.png" alt="HORIZONS Arabic Level 1" width="125" height="84"/><div><h2>HORIZONS Arabic Level 1</h2>{plan_labels}{''.join('<p data-selected-account="' + a + '" hidden><b>' + t('account_' + a) + '</b><br/>' + t('count_' + a) + '</p>' for a in catalog['accounts'])}{facts}</div></div>'
        plans = '<section class="commerce-plans" id="accounts"><h2>' + t('choose_account') + '</h2><div class="commerce-plan-grid">'
        for account, settings in catalog['accounts'].items():
            plans += f'<article class="commerce-plan commerce-account-plan"><h3>{t("account_" + account)}</h3><p>{t("count_" + account)}</p><div class="commerce-plan-options">'
            for plan in settings['plans']:
                amount = settings['plans'][plan]['proposed_minor'] / 100
                plans += f'<button type="button" data-plan="{plan}" data-account="{account}" aria-pressed="false"><span>{t(plan)}</span><strong class="commerce-price" data-account="{account}" data-proposed-price="{plan}">${amount:,.2f}</strong><span>{t("add")}</span></button>'
            plans += '</div><p class="commerce-small">' + t('indicative') + '</p><p>' + t('institution_note' if account == 'institution' else 'permanent_warning') + '</p></article>'
        plans += '</div><p>' + t('updates_note') + '</p></section>'
        for page in ('cart', 'checkout'):
            head = re.sub(r'<title>.*?</title>', f'<title>HORIZONS · {t(page)}</title>', before)
            head = head.replace('product.html', page + '.html')
            head = head.replace('</head>', '<meta name="robots" content="noindex,follow"/><link rel="stylesheet" href="../commerce.css?v=accounts-3"/><script defer src="../commerce-cart.js?v=accounts-3"></script></head>')
            head = head.replace('href="' + page + '.html" lang=', 'href="' + page + '.html" data-commerce-link="' + page + '.html" lang=')
            # The original language-switch links are relative ../lang/page.html.
            head = re.sub(r'href="(\.\./[a-z]{2}/' + page + r'\.html)"', r'href="\1" data-commerce-link="\1"', head)
            step = lambda p: f'<a href="{p}.html" data-commerce-link="{p}.html"' + (' aria-current="step"' if p == page else '') + f'>{t(p)}</a>'
            main = f'<main id="main" class="commerce-main" data-commerce-page="{page}"><ol class="commerce-steps"><li><a href="product.html">HORIZONS Arabic Level 1</a></li><li>{step("cart")}</li><li>{step("checkout")}</li></ol><h1 class="commerce-title">{t(page)}</h1><div class="commerce-notice" role="note"><b>{t("review")}</b><p>{t("review_note")}</p></div>'
            main += f'<section data-empty class="commerce-panel"><h2>{t("empty")}</h2><a href="cart.html" class="text-link">{t("plans")}</a></section>'
            main += '<div class="commerce-grid" data-basket hidden>'
            if page == 'cart':
                main += f'<section class="commerce-panel">{item}<button type="button" class="commerce-remove" data-remove>{t("remove")}</button><div class="commerce-after"><b>{t("access")}</b><p>{t("access_note")}</p></div></section>'
            else:
                def field(key, input_type='text', required=True, limit=160):
                    req = ' required' if required else ''
                    return f'<label class="commerce-field">{t(key)}<input name="{key}" type="{input_type}" maxlength="{limit}" autocomplete="off"{req}/></label>'
                main += f'<section class="commerce-panel"><form data-buyer-form autocomplete="off"><fieldset data-buyer-fields disabled><legend>{t("billing")}</legend><p class="commerce-small">{t("preview_data_note")}</p><div class="commerce-fields">'
                main += field('name') + field('email', 'email', limit=254) + field('email_confirm', 'email', limit=254)
                main += f'<label class="commerce-field">{t("billing")}<select name="billing"><option value="individual">{t("individual")}</option><option value="company">{t("company")}</option></select></label>'
                main += field('country').replace('<input ', '<input list="commerce-countries" ') + '<datalist id="commerce-countries"></datalist>' + field('city').replace('<input ', '<input list="commerce-cities" ') + '<datalist id="commerce-cities"></datalist><p class="commerce-country-help">' + t('location_help') + '</p>' + field('address', limit=400) + field('postal', required=False, limit=32)
                main += f'<div class="commerce-fields commerce-company" data-company-fields hidden>' + field('company_name', required=False) + field('tax_id', required=False, limit=48) + '</div></div>'
                main += f'<fieldset class="commerce-methods"><legend>{t("payment")}</legend><label><input type="radio" name="review-payment-method" value="card" disabled/>{t("card")} · VakıfBank</label><label><input type="radio" name="review-payment-method" value="transfer" checked/>{t("transfer")}</label></fieldset><div class="notice" data-method-note="card" hidden>{t("card_note")}</div><div class="notice" data-method-note="transfer">{t("transfer_note")}</div>'
                main += f'<details class="commerce-legal"><summary>{terms_title}</summary>{terms_article}</details><div class="commerce-policy-links">' + ''.join(policies) + '</div>'
                main += f'<div class="commerce-email-warning" data-permanent-warning>{t("permanent_warning")}</div><label class="commerce-consent"><input type="checkbox" name="permanent" required/>{t("permanent_consent")}</label>'
                main += f'<label class="commerce-consent"><input type="checkbox" name="consent" required/>{t("consent")}</label><button type="submit" class="button" data-review-order>{t("review_order")}</button></fieldset></form>'
                main += f'<section data-order-review hidden tabindex="-1"><h2>{t("review_order")}</h2><p>{t("review_note")}</p><dl data-buyer-summary></dl><h3>{t("payment")}</h3><p data-payment-summary></p><div data-review-transfer hidden>{t("transfer_note")}{bank_details}</div><p>{t("access_note")}</p><p>{t("after_note")}</p><button type="button" class="button ghost" data-edit-buyer>{t("edit")}</button></section></section>'
            main += '<aside class="commerce-panel">'
            if page == 'checkout':
                main += item
            main += f'<div class="commerce-total"><span>{t("total")}<small class="commerce-small"> · {t("indicative")}</small></span><strong data-money dir="auto"></strong></div><p class="commerce-small">{t("billing_note")}</p>'
            if page == 'cart':
                main += f'<a href="checkout.html" data-commerce-link="checkout.html" class="button">{t("checkout")}</a>'
            else:
                main += f'<button class="button" type="button" data-payment-submit disabled>{t("unavailable")}</button>'
            main += f'<div class="commerce-after"><b>{t("after")}</b><p>{t("delivery_note")}</p><p>{t("after_note")}</p></div></aside></div>'
            if page == 'cart':
                main = main.replace('<div class="commerce-grid"', plans + '<div class="commerce-grid"', 1)
            main += '</main><script id="commerce-catalog" type="application/json">' + json.dumps(catalog, ensure_ascii=False).replace('<', '\\u003c') + '</script>'
            (dest / lang / (page + '.html')).write_text(head + main + after)
        # Browser-first entry: demo/signup dialog; existing users retain /learn/.
        for name in ('product.html', 'index.html'):
            path = dest / lang / name
            s = path.read_text()
            s = re.sub(r'<script id="horizons-web-first-1-4">.*?</script>', '', s, flags=re.S)
            s = re.sub(r'<a\b[^>]*data-commerce-action="buy"[^>]*>.*?</a>', '', s)
            s = re.sub(r'<a\b[^>]*data-horizons-action="(?:demo|windows)"[^>]*>.*?</a>', '', s)
            s = re.sub(r'(<a\b[^>]*data-horizons-action="open"[^>]*>).*?</a>', lambda m: re.sub(r'href="[^"]*"', 'href="cart.html#accounts"', m[1]) + t('start') + '</a>', s)
            # Remove obsolete product compatibility/licence prose, preserving
            # the original curriculum description, branding and legal rights.
            if name == 'product.html':
                sections = list(re.finditer(r'<section>.*?</section>', s, re.S))
                if len(sections) >= 3:
                    for match in reversed(sections[1:3]):
                        title = re.search(r'<h2>.*?</h2>', match.group(), re.S).group()
                        note = t('learner_login') + ' ' + t('updates_note')
                        if match is sections[2]:
                            note += ' ' + t('count_individual') + ' / ' + t('count_family') + ' / ' + t('count_institution') + '. ' + t('permanent_warning') + ' ' + t('institution_note')
                        s = s[:match.start()] + '<section>' + title + '<p>' + note + '</p></section>' + s[match.end():]
            path.write_text(s)
        # Persistent cart on every localized public site page, including legal
        # and support pages. Do not inject into the separately released workbook.
        for path in (dest / lang).glob('*.html'):
            s = path.read_text()
            s = re.sub(r'<script id="commerce-ui".*?</script>|<dialog[^>]*data-start-dialog.*?</dialog>', '', s, flags=re.S)
            s = re.sub(r'<(?:script|link)\b[^>]*(?:site-commerce\.js|commerce\.css|location-picker\.js)[^>]*>(?:</script>)?', '', s)
            deps = '<link rel="stylesheet" href="../commerce.css?v=accounts-3"/><script defer src="../site-commerce.js?v=accounts-3"></script>'
            if path.name == 'checkout.html':
                deps += '<script defer src="../location-picker.js?v=accounts-3"></script>'
            # Global basket must initialise before the page-specific basket.
            s = s.replace('</head>', deps + '</head>')
            s = re.sub(r'<script defer src="../commerce-cart.js[^>]*></script>', '', s)
            if path.name in ('cart.html', 'checkout.html'):
                s = s.replace('</head>', '<script defer src="../commerce-cart.js?v=accounts-3"></script></head>')
            ui = {'catalog': catalog, 'cart_path': 'cart.html', 'cart': data['cart'], 'checkout': data['checkout'], 'empty': data['empty']}
            addon = '<script id="commerce-ui" type="application/json">' + json.dumps(ui, ensure_ascii=False).replace('<','\\u003c') + '</script>'
            if path.name in ('index.html', 'product.html'):
                addon += f'<dialog class="commerce-start-dialog" data-start-dialog aria-labelledby="commerce-start-title"><form method="dialog"><button class="commerce-dialog-close" aria-label="×">×</button></form><h2 id="commerce-start-title">{t("start")}</h2><div class="commerce-start-options"><a class="button ghost" href="/try/?lang={lang}">{t("trial")}</a><a class="button" href="cart.html#accounts">{t("signup")}</a></div><a class="commerce-existing-access" href="/learn/?lang={lang}">HORIZONS · {t("access")}</a></dialog>'
            s = s.replace('</body>', addon + '</body>')
            if path.name == 'checkout.html':
                s = s.replace('name="email_confirm"', 'name="email_confirm" data-mismatch="' + t('email_confirm') + '"')
            path.write_text(s)
    (dest / 'commerce.css').write_bytes((SRC / 'commerce.css').read_bytes())
    (dest / 'commerce-cart.js').write_bytes((SRC / 'cart.js').read_bytes())
    for name in ('site-commerce.js', 'location-picker.js'):
        (dest / name).write_bytes((SRC / name).read_bytes())
    for page in ('cart', 'checkout'):
        links = ''.join(f'<a href="{l}/{page}.html" lang="{l}">{l}</a> ' for l in LANGS)
        entry = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>HORIZONS · {page}</title><body><p>HORIZONS · {page} · Review</p>{links}<script>
        (()=>{{const langs={json.dumps(LANGS)};const u=new URL(location.href);const candidates=[u.searchParams.get('lang'),...(navigator.languages||[navigator.language])];const lang=candidates.filter(Boolean).map(x=>x.toLowerCase().split('-')[0]).map(x=>['nb','nn'].includes(x)?'no':x).find(x=>langs.includes(x))||'en';const plan=u.searchParams.get('plan');const account=u.searchParams.get('account')||'individual';const allowed={json.dumps({a:list(v['plans']) for a,v in catalog['accounts'].items()})};const q=allowed[account]?.includes(plan)?'?account='+account+'&plan='+plan:'';location.replace(lang+'/{page}.html'+q)}})();
        </script></body></html>'''
        (dest / (page + '.html')).write_text(entry)
    print(f'Built {len(LANGS)} account carts/checkouts with a persistent cart; collection remains disabled.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dest', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().dest)
