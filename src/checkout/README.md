# Checkout for bank review — 2026-10-02

This is an independently installed, explicitly non-collecting checkout. It can
record encrypted review orders with server-issued unique references. Records are
always `review_only`, `unpaid`, `not_issued` (invoice) and `not_started`
(fulfilment). A reference is not evidence of a payment or a payable TRY quote.

The only public endpoint is `/checkout-api/`: GET establishes an HttpOnly, Secure,
SameSite=Strict CSRF session; POST validates the selected published product/offer,
buyer and required acknowledgements and creates an idempotent review record.
Unrecognised fields (including card numbers and client-supplied prices) are rejected.
No card form, card endpoint, gateway credentials or payment-success callback is
exposed. Server prices are authoritative. Transfer review is limited to TR; company
invoices require company name, Turkish tax number and tax office.

The private installation is a sibling of public_html, `horizons-checkout-review`:
`ReviewOrders.php`, `products.json`, owner-only `key.bin` and a separate SQLite file.
Buyer details are encrypted with Sodium; client/request/IP identifiers are keyed
hashes. A bounded per-IP rate and transactional request idempotence prevent routine
duplicates. Expired review records are pruned on the next successful order after
30 days; this is not yet an unattended legal-retention scheduler. No buyer details
are placed in URLs, localStorage, sessionStorage, public logs or API responses.

Do not present the review references as confirmed sale orders. The visible form
and result instruct the visitor not to transfer money in this phase. Existing
activation databases, mail configuration and scheduled membership worker are not
read or changed. The approved product cover and published prices are preserved.

## Future live integration boundary

Before collection, replace the review-only service through a separate reviewed
release. Live orders need durable versioned contract/pre-information snapshots,
consent evidence, payment-currency quotes, cancellation/refund handling, seller
accounting policy, verified merchant eligibility and final bank approval.

The intended durable, idempotent event sequence is:

1. A VakıfBank server-side adapter verifies the bank's result and independently
   checks merchant, terminal, order, transaction, amount and currency. A return-page
   query or customer's transfer receipt upload never proves settlement.
2. The order transitions from unpaid to paid exactly once; reconcile duplicate,
   delayed and out-of-order notifications using a unique bank transaction reference.
3. An approved e-Fatura/e-Arşiv adapter creates the applicable legal invoice once.
   Failure stays in a retryable invoice-pending state; do not invent invoice IDs.
4. The product's registered fulfilment adapter grants access once. For the workbook,
   integrate the existing membership service through its verified order bridge;
   do not modify its database directly or share a code between buyer identities.
5. The existing mail queue sends the invoice/access instructions to the verified
   purchaser and records retries. No customer email is sent by this review service.

The bank must confirm the available hosted payment integration and provide test
credentials and official callback rules. Do not infer endpoints or reuse sample
merchant IDs. PAN/CVV must not enter the HORIZONS application, logs or database.
Final bank flow depends on the hosted model enabled for this merchant.

EFT/FAST operate in TRY. Catalog USD amounts must not be sent as TRY amounts.
An approved final TRY quote, exchange-rate source/timestamp and expiration policy
are required before local transfer collection. No invented exchange rate is used.

## More products

`src/commerce/products.json` is the product registry, with a stable product ID,
availability, image, offers (ID, currency, integer minor-unit price, tax inclusion)
and a future fulfilment adapter ID. Add only released products. The checkout and
review order service resolve the product and offer from this registry; unavailable
or unknown products cannot be ordered. The published catalog contains no secrets.
The current single-item checkout can accept any configured product; a new product
does not require changes to the issuer or a new checkout route. New product types
also need their own delivery/licence clauses in the policy builder before release.

## Reference material checked

- Turkish Ministry of Trade: https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme
- KVKK disclosure duties: https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-
- TCMB payment systems: https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB%2BTR/Main%2BMenu/Temel%2BFaaliyetler/Odeme%2BSistemleri/Turkiyedeki%2BOdeme%2BSistemleri/Elektronik%2BFon%2BTransfer%2B%28EFT%29%2BSistemi
- VakıfBank official guide listing: https://www.vakifbank.com.tr/tr/ticari/kobilere-ozel/posuye-is-yeri-hizmetleri/pos-destek/sanal-pos-kilavuzlari

This preparation is not a claim of bank acceptance, a legal opinion, verified
ETBİS registration, approved foreign data-transfer arrangements or an integrated
tax invoice provider. Have Turkish counsel/accounting and the bank confirm the
applicable operational details before collecting payment. Required purchase-term
acceptance is separate from acknowledgement of the privacy notice; no marketing
consent is bundled with either.
