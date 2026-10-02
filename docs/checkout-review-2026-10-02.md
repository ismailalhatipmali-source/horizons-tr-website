# Checkout / Ödeme — bank review release

The owner requested a visible 32-language checkout for VakıfBank review, with bank
transfer and a clearly pending Sanal POS route, and explicitly required a file plan
before touching activation, mail or existing databases. The plan was displayed in
the conversation before the separate review service was implemented. The existing
activation/mail/database stack is unchanged by this checkout release.

The earlier, separately authorised contact work was already completed: all four
missing public mail aliases forward to info; phone +905522268840 and three contact
roles were published at commit ee6558732406266d646e059b5d0aed17e3b042dd. cPanel showed
that contact deployment at 2026-10-02 12:03:45 Europe/Istanbul.

## Delivered scope

- Purchase CTA on the released Arabic workbook, not the nine upcoming projects.
- Generic public product/offer registry; current seven approved tax-inclusive offers.
- Checkout and cart entry pages in 32 languages, four RTL directions, a persistent
  basket containing product metadata only, and the unchanged approved cover.
- First/last name, email confirmation, phone, country, city, billing address and
  individual/company invoice type. Company name, tax number and tax office required
  for company invoices. Self-hosted worldwide country labels and city suggestions.
- Separate required purchase-terms and privacy-notice acknowledgement, with the
  existing permanent-email acknowledgement for individual/family accounts.
- 128 linked policy pages: pre-information, distance sales, returns/cancellation and
  checkout privacy, using the existing translated statutory-rights clauses.
- Visible Havale/EFT/FAST (Türkiye, TRY) and credit/debit card via VakıfBank Sanal POS.
  No card inputs, PAN/CVV storage, gateway credentials or success callbacks.
- Server-issued unique review references, encrypted isolated private records,
  retry idempotence, authoritative product prices and an always-unpaid state.
- Print/save-PDF of the local review summary and reference, not a tax invoice.
- Signed-off-code future sequence documented: verified payment → paid order →
  legal invoice adapter → product fulfilment adapter → existing mail queue.

## Deliberate phase boundaries

The release is visibly **bank review**, not collection enablement. USD prices are
preserved. No invented TRY quote or FX rate is used; EFT/FAST must get a confirmed
TRY amount before launch. Visitors are told not to send funds now. Saved references
are review records, not payable/paid sales. No invoices, activation rights or
customer emails are created. Real payment, legal invoice and activation adapters
will be connected after the bank supplies its test integration and the owner
confirms the applicable live-sale/accounting/privacy details.

This is not a certification of Turkish legal compliance or bank acceptance. The
existing company identity is shown. Mandatory rights remain intact. Final Turkish
legal/accounting review, bank approval, applicable registration obligations and
hosting/data-transfer arrangements still require confirmation before collection.
See src/checkout/README.md for the checked official references and integration contract.

## Files and validation

Builder: `scripts/build_checkout_review.py`; translation source:
`src/commerce/checkout-locales.json`; generic catalog: `src/commerce/products.json`.
Private service: `src/checkout`; public UI: checkout.js / checkout.css and the
updated site-commerce.js basket. Publication manifest:
`release-assets/checkout-20261002/checkout-manifest.json`.

The hardened `scripts/deploy-checkout.php` preflights all 554 target hashes, rejects
changed public files before writing, backs up changed files privately, preserves
the isolated encryption key on retries, restores written files on failure, and
cannot target activation/mail/progress paths. New private records are outside
public_html. The manifest installs dependencies before the HTML pages.

Validation completed before publication:

- tests/test_checkout_review.php: unique references, duplicate replay, rejected
  price/card injection, consent, country/company requirements, encrypted storage,
  generic second product and unpaid-only state; no bank/mail invoked.
- tests/test_checkout_review.mjs: full form flow in all 32 locales, company fields,
  card disabled, separate consents, reference receipt, RTL/LTR and no buyer storage.
- Actual 554-file deployment simulation: preflight, user-edit rejection before any
  write, exact resulting hashes, backups, 0600 private key/files, idempotent replay,
  and preservation of activation, mail and learner progress fixtures.
- All 32 page field/link/CTA checks; cover SHA256 remains
  ebd1e106f784f1fe235521ab603dc79d988a8bc04f906f0b333a0f0ce71e4ea2.

## Live verification

Published through cPanel at 2026-10-02 12:43:42 Europe/Istanbul (09:43:42 UTC).
The live deployment commit is `ad0ae268c907cbf40e6373810bf9652d00389efd`,
whose tree exactly matches local implementation commit `e7eae57`.

- Turkish product page exposes Satın al linked to the generic checkout.
- Turkish checkout rendered seven offers, the company/IBAN details and 250
  country/territory choices; company selection exposed all three invoice fields.
- A filled card review showed VakıfBank Sanal POS and a disabled final button.
  No card inputs or payment attempt were involved.
- Switching that fake test to transfer created server reference
  `HZN-R-20261002-0880AD8478327CE3BDFF`, explicitly unpaid and review-only,
  with no invoice, activation or email. Buyer data used an example.test email,
  a dummy phone and an explicitly non-customer test address.
- Arabic checkout rendered RTL, 9.99 USD inclusive of taxes, the same approved
  cover, the floating basket, and all four policy links; neither Turkish nor
  Arabic had horizontal overflow at the tested desktop viewport.
- Turkish refund and checkout-KVKK pages opened successfully with the correct
  phone, mandatory-rights wording and company identity. Only an unrelated
  browser-extension console warning was observed during the checkout test.

Browser proof: `horizons-checkout-live-20261002.jpg`. The 32-language automated
checks above complement these live desktop checks; this is not a claim of
testing every physical device/browser. No real payment was taken or tested.
