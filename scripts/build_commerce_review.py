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
    if catalog['mode'] != 'review' or catalog['charges_enabled'] is not False or catalog['price_approved'] is not False:
        raise ValueError('This builder supports review only; use an audited payment service for live checkout.')
    labels = json.loads((SRC / 'locales.json').read_text())
    for lang in LANGS:
        data = labels[lang]
        if set(data) != set(labels['en']) or any(not isinstance(x, str) or not x.strip() for x in data.values()):
            raise ValueError(f'Incomplete commerce locale: {lang}')
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
        facts = f'<div class="commerce-facts"><span>28 {t("lessons")}</span><span>560 {t("cards")}</span><span>56 {t("stories")}</span></div>'
        plan_labels = ''.join(f'<span data-selected-plan="{p}" hidden>{t(p)}</span>' for p in catalog['plans'])
        item = f'<div class="commerce-item"><img src="../assets/covers/{lang}/arabic.png" alt="HORIZONS Arabic Level 1" width="125" height="84"/><div><h2>HORIZONS Arabic Level 1</h2>{plan_labels}{facts}</div></div>'
        plans = '<section class="commerce-plans"><h2>' + t('plans') + '</h2><div class="commerce-plan-grid">'
        for p in catalog['plans']:
            plans += f'<article class="commerce-plan"><h3>{t(p)}</h3><span class="commerce-price" data-proposed-price="{p}"></span><p class="commerce-small">{t("indicative")}</p><button type="button" class="button" data-plan="{p}" aria-pressed="false">{t("add")}</button></article>'
        plans += '</div></section>'
        for page in ('cart', 'checkout'):
            head = re.sub(r'<title>.*?</title>', f'<title>HORIZONS · {t(page)}</title>', before)
            head = head.replace('product.html', page + '.html')
            head = head.replace('</head>', '<meta name="robots" content="noindex,follow"/><link rel="stylesheet" href="../commerce.css?v=review-1"/><script defer src="../commerce-cart.js?v=review-1"></script></head>')
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
                main += f'<section class="commerce-panel"><label class="commerce-email">{t("email")}<input type="email" disabled autocomplete="off" placeholder="name@example.com" aria-describedby="review-email-note"/></label><p id="review-email-note" class="commerce-small">{t("review_note")}</p><fieldset class="commerce-methods"><legend>{t("payment")}</legend><label><input type="radio" name="review-payment-method" value="card" checked/>{t("card")} · VakıfBank</label><label><input type="radio" name="review-payment-method" value="transfer"/>{t("transfer")}</label></fieldset><div class="notice" data-method-note="card">{t("card_note")}</div><div class="notice" data-method-note="transfer" hidden>{t("transfer_note")}</div><div class="commerce-policy-links">' + ''.join(policies) + '</div></section>'
            main += '<aside class="commerce-panel">'
            if page == 'checkout':
                main += item
            main += f'<div class="commerce-total"><span>{t("total")}<small class="commerce-small"> · {t("indicative")}</small></span><strong data-money dir="auto"></strong></div><p class="commerce-small">{t("billing_note")}</p>'
            if page == 'cart':
                main += f'<a href="checkout.html" data-commerce-link="checkout.html" class="button">{t("checkout")}</a>'
            else:
                main += f'<button class="button" type="button" disabled>{t("unavailable")}</button>'
            main += f'<div class="commerce-after"><b>{t("after")}</b><p>{t("after_note")}</p></div></aside></div>'
            if page == 'cart':
                main += plans
            main += '</main><script id="commerce-catalog" type="application/json">' + json.dumps(catalog, ensure_ascii=False).replace('<', '\\u003c') + '</script>'
            (dest / lang / (page + '.html')).write_text(head + main + after)
        # Keep the workbook/demo/installer entry points in their original order.
        buy = f'<a href="cart.html" class="button ghost" data-commerce-action="buy">{t("buy")}</a>'
        for name in ('product.html', 'index.html'):
            path = dest / lang / name
            s = path.read_text()
            s = re.sub(r'<a\b[^>]*data-commerce-action="buy"[^>]*>.*?</a>', '', s)
            anchor = re.search(r'<a\b[^>]*data-horizons-action="demo"[^>]*>.*?</a>', s)
            if not anchor:
                raise ValueError(f'Missing demo entry point: {lang}/{name}')
            s = s[:anchor.end()] + buy + s[anchor.end():]
            path.write_text(s)
    (dest / 'commerce.css').write_bytes((SRC / 'commerce.css').read_bytes())
    (dest / 'commerce-cart.js').write_bytes((SRC / 'cart.js').read_bytes())
    for page in ('cart', 'checkout'):
        links = ''.join(f'<a href="{l}/{page}.html" lang="{l}">{l}</a> ' for l in LANGS)
        entry = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>HORIZONS · {page}</title><body><p>HORIZONS · {page} · Review</p>{links}<script>
        (()=>{{const langs={json.dumps(LANGS)};const u=new URL(location.href);const candidates=[u.searchParams.get('lang'),...(navigator.languages||[navigator.language])];const lang=candidates.filter(Boolean).map(x=>x.toLowerCase().split('-')[0]).map(x=>['nb','nn'].includes(x)?'no':x).find(x=>langs.includes(x))||'en';const plan=u.searchParams.get('plan');const q=['monthly','annual','lifetime'].includes(plan)?'?plan='+plan:'';location.replace(lang+'/{page}.html'+q)}})();
        </script></body></html>'''
        (dest / (page + '.html')).write_text(entry)
    print(f'Built {len(LANGS)} review carts and checkouts; collection disabled; final checkout totals and settlement currency remain pending.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dest', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().dest)
