# Live deployment record — 2026-10-02

## Published

- Site: https://horizons-tr.com/
- Account plans: https://horizons-tr.com/ar/cart.html#accounts
- Full workbook: https://horizons-tr.com/learn/ — 1.4.4
- Free demo: https://horizons-tr.com/try/ — 1.4.3
- cPanel last verified deployed commit: `7b4dbd549a4145484cd09ce8a6b2dcbecaa55ba0`.
- cPanel successful deployment time: 2026-10-02 08:59:39, Istanbul time.
- Private service installation preserved the existing configuration, signing
  vault, activation database and learning progress. The installer reported the
  private backup `membership-backup-20261002-045402-75fbe4`.

## Actual checks

- Home “ابدأ التعلّم” opens the demo/subscription choice without scrolling.
- The free demo opens without registration and loads its five Arabic letters.
- No legacy Windows/pilot controls are injected into the membership home page.
- Individual prices: USD 9.99 / 99 / 150; family: USD 20 / 200 / 250;
  institution: annual USD 1,000 only. Prices include tax.
- Selecting family annual shows USD 200. The cart badge remains at one after
  navigation to another public page, and returns to the selected account/plan.
- Checkout supplies 250 country/territory suggestions. Selecting Turkey supplies
  Turkish cities; changing to Germany clears the previous city and loads German
  cities. Manual city entry remains available.
- The full workbook displays 1.4.4 and the email-code membership activation entry.
- PHP 8.2.33 and SQLite 3.26.0 are present. The installer now uses SQLite's native
  backup method where available; its previous failed preflight changed no files.
- The minute worker reports `OK: membership queue processed.` The persistent
  cron has been restored to the worker alone, with no diagnostic operations.
- SMTP certificate-validated TLS and authentication passed against the existing
  mail configuration. Result: `SMTP_AUTH_OK; NO_MESSAGE_SENT`.

Local functional verification covers cryptographic code/password activation,
six device identities, family capacity and fixed emails, institutional revocation,
renewals, encrypted transfer billing, receipt uniqueness, payment-before-access,
retry behavior, learning synchronization, legacy compatibility, all 32 storefront
languages and rollback/preservation. The small storefront publisher's six tests
also cover conflicting files, source hashes, symlinks, locking and public data
directory permissions. These local tests use synthetic accounts and fake bank
and mail adapters; they are not real customer purchases.

## Current payment state and remaining work

**The site is deployed, but sales are not enabled.** Both the public catalogue and
private transfer feature flag remain off. The public checkout explicitly says it
is a preview, retains billing inputs only in page memory, creates no order or
invoice and keeps submission disabled. Card processing and currency conversion
are also off. Do not represent this state as a functioning paid checkout.

Before switching transfer collection on, finish the live order/invoice/refund and
guardian/learner privacy copy, verify delivery to an actual recipient and exercise
activation/password setup and progress synchronization across devices. The current
privacy wording about child accounts must be reconciled with the learner model.
No real email, real paid order, password setup or bank-credit confirmation was
performed during this deployment. Physical Android/iOS/Safari behavior is not
certified by the desktop browser checks.

The transfer integration settles orders in USD at server-side prices. Only an
actual credited transfer can be confirmed by the owner. IBAN details alone do not
provide payment notifications or access to a bank feed. Confirmation queues the
membership and activation mail; the minute worker retries unfinished delivery.
Card payment requires the bank's integration details and validation before its
control can be enabled. Display FX does not yet run.

## Host operation

The installed private minute task is equivalent to:

```sh
/usr/local/bin/ea-php82 -r '$argv = ["membership-worker", require "/home2/horizonstr/public_html/activation/config-path.php"]; require "/home2/horizonstr/horizons-license/app/worker.php";'
```

It runs with `umask 077` and writes only its status to the private
`horizons-membership-update/worker-status.log`. No password or key is placed in
the cron command or this repository.

After transfer collection is deliberately enabled and the owner has checked the
actual credited amount, the private worker accepts:

```text
php worker.php CONFIG_PATH confirm-transfer ORDER_ID BANK_REFERENCE USD AMOUNT_IN_CENTS
```

This is a payment confirmation, not a test command. Never use invented receipts or
mark an unpaid order paid. The amount must match the order and the bank reference
must be unique. A customer-side claim cannot grant access.

Current cPanel publication runs the checked-in `.cpanel.yml`. It validates the
storefront manifest before public writes and keeps a private rollback copy. The
full `deploy-cpanel.sh` archive-rebuild path is retained for historical installation
work, but is no longer the per-edit storefront deployment command. Private state
and backup files must remain outside `public_html` and Git.
