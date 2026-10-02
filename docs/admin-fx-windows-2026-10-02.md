# HORIZONS owner administration, exchange rates and Windows launcher

Prepared 2 October 2026. This release does not enable public bank collection or Sanal POS.

## Owner use

Open `/admin/`. Request a one-time eight-digit login code sent only to `info@horizons-tr.com`; the recipient cannot be supplied by the browser. Codes last ten minutes, permit five verification attempts, are bound to the requesting browser session, and are usable once. Login requests are limited. Sessions expire after 30 minutes idle or 60 minutes total; writes require authentication within 15 minutes. No password or customer activation code appears in the dashboard.

Choose **تفعيل اشتراك**. Confirm the buyer's email twice, billing details, one of seven offers, mail language (32 choices) and settlement currency. The four steps are:

1. Save customer-confirmed order data. No license or customer message is issued.
2. Check the actual company bank account, then record the unique transaction reference and the exact received amount/currency.
3. Issue the invoice through the existing external invoicing system and record its number. This dashboard does not generate a Turkish tax invoice.
4. Confirm the recipient and issue the subscription. Existing membership services queue the activation email; the existing scheduled worker sends it. Monitor the delivery status under customers. Repeat attempts reuse the same purchase/group; they do not grant another subscription. Resend queues to the same fixed buyer address.

Individual/family/institution entitlements remain 1/5/100 learners. Institution has annual only. Existing renewal and permanent-email rules remain in the shared membership service. Public checkout review records are shown separately and cannot be fulfilled as paid sales.

## Currency quotes

USD catalog prices remain unchanged. Supported settlement currencies are USD, TRY and EUR, matching the company's published accounts. TCMB `https://www.tcmb.gov.tr/kurlar/today.xml` is primary; the official ECB provider via `https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=TRY,EUR` is fallback. Both are daily reference data, not a tick-by-tick trading feed. The server refreshes on demand after 30 minutes and accepts at most five calendar days of source age to cover non-business days. If no sufficiently current cached/feed rate is available, conversion fails closed; USD remains available. Buyers' personal data is never sent to providers.

TRY uses TCMB USD forex selling; EUR crosses USD selling / EUR buying. A disclosed default 3% conversion margin applies to non-USD quotes. Owner can set 0–10%; it does not guarantee coverage of every possible bank fee or currency move. Integer minor units round upward, with overflow guards. Each quote carries its source, date, margin, product/offer, base price, currency and total. An HMAC signature binds the quote for 15 minutes. The saved order retains its quoted total; changed catalog prices or expired/tampered quotes are rejected before order creation.

## Deployment and protection

`src/admin`: Arabic RTL owner interface and PHP endpoint; private classes publish outside `public_html` under `horizons-admin`. A new random private key is created once, never overwritten, and customer/order payloads are encrypted. CSRF, same-origin checks, Secure/HttpOnly/SameSite sessions, authentication gates, audit events and no-store responses protect the console.

`src/checkout`: ExchangeRates plus quote verification added to the isolated unpaid-review service. Existing activation source, SMTP settings, license keys, databases, progress, lessons, media and approved cover are not replaced by this deployment. No test sends an actual email or grants an actual customer license.

`release-assets/admin-fx-20261002/manifest.json` pins every source and production baseline. `scripts/deploy-admin.php` verifies everything, backs up replaced files outside the web root, rejects unknown edits/symlinks, publishes via atomic rename and rolls back on failure. Repeated deployment preserves keys/data. It requires PHP curl, SimpleXML, PDO SQLite, sodium and openssl. The cPanel task runs this publisher.

## Optional Windows 1.5.0

The single `HORIZONS-Arabic-Setup-1.5.0.exe` installs a small per-user x64 launcher, a Start Menu entry, an optional desktop shortcut and an uninstaller. It opens only `https://horizons-tr.com/learn/` in the default browser. This follows the primary browser-based product; it is not an updated bundled Electron/offline engine. It keeps browser progress, uses the workbook's existing lesson-saving mechanism, and does not automatically remove a legacy standalone version. Installer UI supports Arabic, Turkish and English; download descriptions exist in all 32 site languages.

Built with official MinGW and NSIS tools; SHA256 and sizes are in `release-assets/windows-1.5.0/build-report.json`. No Authenticode certificate is present. Binary format and build were checked; actual install/uninstall on a physical Windows system remains to be verified. The old standalone update feed is unchanged.

## Verification

- `tests/test_admin_fx.php`: feed parsing, cache/fallback, stale rejection, exact rounding, high-rate overflow, signed quote tamper/expiry, session-bound OTP, one-use/lockout, seven paid/invoiced offer types and correct seat rights, duplicate prevention, encrypted private data and pending mail queue. Synthetic data only.
- `tests/test_admin_ui.mjs`: four-step owner workflow, explicit confirmations, HTML escaping, 32 mail languages, no browser storage and private view clearing on logout. Mock API only.
- `tests/test_checkout_review.mjs`: all 32 complete forms and directions, FX selection, company fields, disabled collection/card and server reference handling.
- `tests/test_checkout_review.php`: authoritative catalog, required consents, idempotent unpaid references and future product support.
- `tests/test_admin_deploy.py`: complete overlay, existing-file conflict refusal, backup hashes, private permissions, idempotence, preservation of unrelated mail/activation/progress and anonymous API/CSRF/origin denial.

Real owner login and real SMTP delivery must be checked by the owner receiving the code. They are not simulated as live successes.

ملاحظة: المنتجات الرقمية ستصدر تباعًا، لذلك صمّم نظام Checkout بشكل عام وقابل لإضافة منتجات جديدة لاحقًا، وليس مربوطًا بمنتج واحد فقط.
