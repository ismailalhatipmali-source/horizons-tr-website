# Global price display — 2 October 2026

Country-aware display is available on the product, cart and checkout pages in all 32 site languages. The USD catalog remains authoritative. Customers can choose a country or override the display currency. Only the currency preference is remembered in localStorage; no billing information is sent to an FX provider.

## Display, transaction and card account currencies

- Display: informative conversion to a current tender currency from pinned Unicode CLDR 48, including Arabic and Asian markets. 250 country/territory choices, 153 current currencies. ExchangeRate-API's tested response covers 152 of these; KPW is listed but fails with an explicit unavailable message. Antarctica has no official currency and preserves the chosen display preference. Countries with multiple current currencies use CLDR order and allow manual override. Bulgaria maps to EUR and Zimbabwe to ZWG.
- Transaction: the existing server-authoritative signed USD/TRY/EUR quotes remain unchanged. Display estimates cannot be used as quote tokens or authorize payment. Non-USD settlement margins remain in the existing quote calculation. When checkout selects TRY or EUR, the display conversion is calculated from that signed transaction total, including its existing margin exactly once. Product-page estimates use the USD catalog price.
- Card account: the issuer determines the billing currency, conversion rate and possible fees according to the customer's card agreement. Display conversion is not DCC and does not guarantee a card debit amount. VakıfBank credentials, merchant currency approval and integration are still pending; no cards are collected or charged.

## Reference data

Fixed server-side URL: https://open.er-api.com/v6/latest/USD . Free, no API key, updated daily (not streaming FX). Attribution links appear on every page using the conversions. https://www.exchangerate-api.com/docs/free and https://www.exchangerate-api.com/terms were reviewed. Raw rates stay private; the public endpoint converts only published catalog products, not arbitrary user-supplied amounts. TLS verification, fixed URL, response size/timeout limits, shared cache, nonblocking lock and one-hour failure cooldown apply. Last-known data is accepted only within 72 hours of its actual provider timestamp; that date is displayed. Beyond that the conversion is unavailable and the original catalog/transaction price stays visible.

Currency-region data: https://github.com/unicode-org/cldr-json/tree/48.0.0/cldr-json/cldr-core/supplemental . Vendored currencyData JSON and Unicode license included; build_currency_metadata.py pins the effective date. Only current legal-tender currencies are offered, excluding historical/commodity units. Display precision follows CLDR; actual settlement remains the existing two-decimal USD/EUR/TRY implementation.

Primary payment references: https://www.visa.co.uk/travel-with-visa/dynamic-currency-conversion.html and https://sanalpossandbox-test.vakifbank.com.tr/Home/TestCards . No claim of bank approval or full legal certification is made by this release.

## Files and deployment

New private DisplayExchangeRates.php and currency metadata; additive read-only display_price branch in checkout public-index.php. New display-currency.js/css, metadata, 32 translations, generated product/cart/checkout HTML and builder. Existing policy pages only inherit the already released site.js cache version; legal text is unchanged.

Bounded deploy-display-currency.php overlay compares all targets to the exact previously published 13e7c0205247ad1327e248811ca627d8a8b78a02 tree (local 964de82), backs up changed files outside the public root, stages atomic file replacements and rolls back on failure. Preserves licensing, mail, membership databases, admin access configuration, existing settlement settings, Windows installer and approved cover. Re-running is safe.

## Verification

- test_display_fx.php: current country mappings; 0, 2, 3 decimal handling; authoritative catalog totals; conversion of signed quote with no repeated margin; cache, failure, stale/future/invalid feeds; unsupported currencies; estimates rejected as settlement authorization.
- test_display_currency.mjs: all 32 languages and RTL/LTR markup; selected-country conversion, manual overrides, 7 offers, source attribution, quote-bound totals, failure removes old estimate, out-of-order responses; no buyer data persistence or external client requests.
- test_display_currency_deploy.py: exact overlay, conflict protection, backups, file permissions, repeat publishing, unchanged owner/license/mail/DB sentinels, public API catalog authority, origin and token validation.
- Existing checkout JS/PHP and admin/settlement FX test suites pass without network or SMTP delivery.

Live deployment and UI checks are recorded after publishing.
