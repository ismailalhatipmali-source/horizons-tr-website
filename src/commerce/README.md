# VakıfBank checkout preparation — 2026-09-30

This is a **review build**, not a connected bank checkout. The cPanel deployment
copies `dist/` pages only. It does not deploy or run `PurchaseLedger.php`. No buyer
data, private activation files, credentials, customer database,
reusable licence code, or signing key is committed here.

## Prepared in this branch

- Workbook → plan selection → basket → checkout preview, in all 32 existing site
  languages, with the existing typography, branding and RTL/LTR direction.
- One workbook licence per basket; switching plan replaces the previous plan.
- Basket carries only a product/plan/quantity in its own session storage key.
  Learner progress, activation, password, offline media and sync are untouched.
- Card and bank transfer have visible separate explanations. Buyer/billing fields and a review/edit step work entirely in page memory.
  Payment submission is disabled, including when a URL says `success=true`.
- Prices shown are **the owner's approved base prices (30 September 2026)**, visibly provisional:
  USD 9.90 / 99 / 150. Final tax-inclusive checkout totals and settlement currency remain unapproved. They are not tax determinations, an offer
  to charge, or a promise that the bank supports these currencies. Pages are
  `noindex`. The builder refuses live collection flags.
- Existing terms, privacy, company details and support remain linked. The IBAN
  includes the three owner-supplied corporate TRY/USD/EUR accounts. Format and MOD-97 checks pass; beneficiary ownership is supplied by the owner, not independently verified.

## Product decision

Use **one paid entitlement bound to the adult purchaser's verified email, with
three registered device slots**. Do not email three reusable codes. The existing
web 1.4.2 client already verifies paid `direct` entitlements with `max_devices=3`.
On a new device, the purchaser uses that same email with the existing proof of
ownership/password flow. An email OTP remains one-use and separate from the
licence period. The initial purchase email will contain the order reference,
plan, access instructions and `/learn/`, rather than a decryption key.

The private issuer must upgrade an existing trial account without discarding
its stable account ID, learner records, password or already registered device.
The three slots are registered **devices**, not three separate purchases or
three learner profiles. User-initiated progress sync stays opt-in.

## Prepared internal ledger and activation contract

`PurchaseLedger.php` runs only on PHP 8.2+ with PDO SQLite in a private directory
outside `public_html`, when a later reviewed integration enables it. It is
validated separately using a **fake BankVerifier**. No production bank adapter exists here.

1. Server creates an order from its private approved price catalog (minor integer
   units), fixes the email, and assigns distinct order and transaction IDs.
2. A bank adapter creates the bank-hosted payment session. Exact endpoints,
   request signing and merchant/terminal settings must follow the current
   integration pack issued for this merchant. No browser card fields are needed
   when an approved hosted page is available.
3. A callback is only a signal to query. `BankVerifier::querySale` independently
   queries the stored transaction on the bank server and normalizes a confirmed
   **financial sale**. A 3-D authentication success or an authorization hold
   is insufficient. The adapter must verify merchant, terminal, order, transaction,
   exact amount, currency, approval, sale state and reversal state.
4. The ledger checks the normalized result against the stored order and commits
   `paid` with one `grant_access` outbox row in a single SQLite transaction.
5. A **private activation adapter, still to implement**, delivers that row to
   the existing issuer. The issuer must enforce a unique `order_id` in its own
   transaction and update/renew the existing account with the appropriate plan
   and `max_devices=3`. Grant retries must return the same account and effective
   licence period, including after a worker crashes.
6. Only after the private issuer acknowledges that grant is the order changed to
   `access_ready` and one `send_access_mail` job queued. SMTP is **not implemented
   or invoked** by this preparation. A mail worker must record delivery/retry
   status and use the order ID as its idempotency key. The ledger currently
   provides durable event rows, not a complete worker/scheduler system.

Monthly/annual access is a calendar period handled by the existing issuer.
Automatic recurring charges are **not** enabled; the bank agreement, consent,
renewal rules and cancellation flow need separate validation. Bank transfer
must be matched against funds actually credited to the corporate account,
not a screenshot or a client-side “I paid” flag. Its verification adapter is
also unimplemented. Refunds, cancellations and disputed payments require
authenticated reversal handling, reconciliation, licence revocation/adjustment
and preservation of learner progress **before any live collection opens**.

## Next prerequisites before bank review/publication

- Base prices approved by the owner: USD 9.90 / 99 / 150. Confirm sale currency and tax-inclusive totals, with
  accounting confirmation where needed. Turkish lira transfer details must not
  silently reuse a USD total or an invented conversion rate.
- Owner supplied corporate TRY/USD/EUR IBANs on 30 September; bank linkage and payment currency remain pending.
- Current VakıfBank merchant integration pack confirms whether a bank-hosted
  payment page, accepted currencies, foreign cards and recurring charges are
  enabled for this account. Keys are set privately on the server, not in chat/Git.
- Final pre-contract information, delivery timing, invoicing and applicable
  cancellation/refund terms must match the actual product and bank agreement.
- Private activation purchase adapter, bank adapter, transfer verification,
  consent/order endpoints, queue workers and reversal handling are implemented
  and tested with the bank's sandbox, then a controlled live transaction.
- Workbook password/device, export/restore, physical-device sync and sound checks
  in the owner's handover remain open. This branch resolves none of those.

Do not start another cPanel deployment while the existing demo deployment is
running. This preparation lives on `prepare/vakifbank-checkout` for review; it
does not replace the published demo fix on `main`.

## Primary references

- VakıfBank's public [integration guide 2.4](https://vbassets.vakifbank.com.tr/ticari/pos-uye-is-yeri-hizmetleri/vakifbank-sanal-pos-entegrasyon-dokumani-2.4-versiyon.pdf),
  §5.3: financial provision, transaction/order references and result queries.
  Its public endpoint examples are not assumed current for this merchant.
- VakıfBank's public [sandbox](https://sanalpossandbox-test.vakifbank.com.tr/)
  distinguishes authentication, provision and transaction status. No transaction
  was submitted to the bank during this task.
- [Turkish Ministry of Trade: distance contracts](https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme),
  pre-contract seller, total price, delivery and consumer-rights information.

## Rebuild and validate

```sh
python3 scripts/build_commerce_review.py
php tests/test_purchase_ledger.php
# Serve dist/ locally, then use tests/test_commerce_browser.mjs.
```

## Validation on 30 September 2026

- Owner approved base prices; final checkout totals, tax treatment and bank settlement currency remain pending.
- PHP 8.3 isolated ledger test passed (fake bank, no production calls).
- 64 cart/checkout DOM integration cases passed using jsdom; local asset/navigation links checked.
- 22 deployment regression tests passed.
- Chromium and agent-browser could not launch in this execution environment (`socket() Operation not permitted`). The visual/mobile browser test is present but has NOT passed here.
- No bank adapter, payment endpoint, activation issuer adapter or SMTP worker was deployed.
- This branch is a review preparation, not yet a complete bank-ready/live checkout.

## Currency display

Owner requested local-currency display. Display FX is configured but disabled pending a deployed server-side rate feed. Use dated indicative TCMB rates where available, allow manual currency selection, never equate interface language with country, and show USD when rates are missing/stale. Any future settlement conversion must be server-side and fix amount, currency, rate and expiry on the order; a browser estimate cannot authorize payment. Bank-card settlement currencies require the merchant agreement. No live FX feed is active in this review.

## Checkout review expansion — 30 September 2026

- Full name, adult email, billing country/city/address, optional postal code and individual/company invoice selection in all 32 languages. Company name is required for company billing; tax number is optional in the review and jurisdiction-specific live invoicing validation is still required.
- Required acknowledgement of purchase terms/privacy, with existing translated statutory-rights and seller information visible inside checkout. This acknowledgement is not a waiver of withdrawal rights or permission for early digital delivery.
- Validated review step shows the buyer's input using text nodes (not HTML), payment choice and corporate accounts; edit returns to the existing form. No buyer data is transmitted, persisted, placed in URL parameters or assigned an order number.
- Fields begin disabled without JavaScript. The submit handler is installed before enabling them; the final payment control stays disabled throughout.
- Terms now reflect a single adult account with three registered devices and digital delivery after verified payment. Existing statutory refund/withdrawal wording remains.
- DOM regression covers all 64 pages, empty/invalid forms, explicit acknowledgement, company billing validation, review/edit, injected HTML escaping, transfer accounts, payment disablement and buyer-data non-persistence. It passes.
- Both local Chromium and cloud access to loopback preview are blocked in this session. Visual/mobile verification remains pending; no screenshot or real-bank result is claimed.
- Do not call this a complete bank-approved or live checkout. Final tax-inclusive totals, settlement currency, delivery timing, real invoicing, bank/activation adapters and legal prerequisites remain to finalize before collection.
