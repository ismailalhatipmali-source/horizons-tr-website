# VakıfBank checkout preparation — 30 September 2026

## Current release: non-collecting bank review

The owner approved final **tax-inclusive USD totals**: monthly **9.99**, annual
**99**, lifetime **150**. No tax is added above these totals. The invoicing tax
rate/breakdown requires accounting configuration before live sales; no tax rate
is invented here. Approval of prices never enables collection.

All 32 existing languages have plan selection → basket → adult buyer/billing
form → terms/privacy acknowledgement → order review/edit → disabled payment
placeholder. Corporate TRY/USD/EUR IBANs supplied by the owner pass format and
MOD-97 checks. Ownership is owner-supplied, not independently verified. Digital
delivery and the existing statutory refund/withdrawal conditions are explained.

One adult account owns the paid entitlement with **three registered device
slots**, separate learner profiles and the same email/password on each device.
Do not email three reusable codes. The activation adapter must upgrade a trial
without replacing its stable account ID, password, progress or registered device.
Email OTPs remain single-use and separate from the licence period.

Buyer input stays in page memory only. No HTTP order endpoint is connected; no
order/invoice is issued. No buyer details enter URLs, local/session storage,
analytics or SMTP. Only product/plan/quantity persist in the basket's session key.
The submit handler is installed before enabling the initially disabled fields.
Native validation and explicit terms acknowledgement precede review. Inputs are
rendered with text nodes. Payment stays disabled regardless of query parameters.
Reading terms is not a waiver of withdrawal rights or early-delivery consent.

Corporate invoice fields are a review UI. Jurisdiction-specific invoicing rules,
including any mandatory tax identifiers, must be enforced by the future server.
No child-identifying fields, card numbers or banking credentials are requested.

## Integration boundary

`PurchaseLedger.php` is an internal PHP 8.2+ / PDO SQLite contract, not an HTTP
payment service. cPanel copies `dist/`; it does not deploy this ledger. Its private
database must stay outside public_html. A trusted BankVerifier queries the stored
transaction and validates financial sale state, merchant, terminal, order,
transaction, exact amount and currency. Authentication alone is not payment.
An atomic paid state and unique outbox job prevent duplicate fulfilment on retries.
The private issuer must independently enforce grant idempotency by order_id.
A mail job is queued only after grant acknowledgement, not after browser success.

No production bank adapter, activation purchase adapter, SMTP worker, transfer
verification, invoice endpoint, reconciliation or reversal handling exists here.
These must be implemented/tested before enabling collection. Transfer access
requires funds actually credited to the matching corporate currency account.
No automatic recurring charge or automatic renewal is enabled.

The bank-review pages can be published while collection remains disabled.
Before enabling sales: validate the bank merchant integration pack and supported
settlement currencies; implement private endpoints/workers and refund/dispute
handling; configure invoicing and consent records; confirm delivery timing and
applicable legal documents; run bank sandbox and controlled live validation.
Workbook password/device, export/restore, physical-device sync and brother's
sound checks in the handover remain open and are unaffected by this preparation.

## Local-currency display

FX display is configured but **disabled**: no live rates are fetched. Future
server-side dated indicative TCMB rates may show an estimated local amount with
manual override and fallback to USD. Never equate language with country. A
settlement conversion must fix amount/currency/rate/expiry on the server-side
order; browser estimates cannot authorize payment. A corporate EUR/TRY account
does not itself prove the card gateway accepts that currency.

## Validation

64 cart/checkout DOM cases pass: plans/navigation/removal, required fields,
explicit acknowledgement, corporate billing, review/edit, HTML escaping,
transfer details, disabled payment, forged-success rejection and no buyer
persistence. Approved amounts and disabled collection are checked for all pages.
22 deployment regressions and isolated PHP 8.3 fake-bank ledger tests pass.
Rebuilding is idempotent. No bank transaction or live order occurred.

Local Chromium/agent-browser launch is blocked by socket restrictions; cloud
access to loopback is also blocked. **Visual/mobile review is still pending**.
Do not claim a browser screenshot, bank approval or completed payment integration.
After cPanel publication the owner should verify the review UI on actual devices.

Build: `python3 scripts/build_commerce_review.py`.
DOM test: `node tests/test_commerce_dom.mjs` (jsdom dependency).
Browser test: `node tests/test_commerce_browser.mjs` (Playwright/Chromium).
Ledger test: `php tests/test_purchase_ledger.php` (PDO SQLite).
Deployment test: `python3 -m unittest discover -s tests -p test_deploy_cpanel.py`.

Official references:
- [VakıfBank integration guide](https://vbassets.vakifbank.com.tr/ticari/pos-uye-is-yeri-hizmetleri/vakifbank-sanal-pos-entegrasyon-dokumani-2.4-versiyon.pdf).
- [Ministry of Trade distance-contract guidance](https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme).
