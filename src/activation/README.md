# Membership integration 1.4.4

This extends the owner-supplied issuer, preserving account IDs, passwords, signing
vault and progress identities. No production configuration or keys are committed.
One-use email codes open a separate password-setup step; subsequent login uses
email/password on any device. Invitations have independent accounts. Roster actors
are derived from authenticated proof of a registered device key. Revocation blocks
new online requests; offline membership licences expire within 24 hours. Lifetime
subscriptions also need periodic online verification. Legacy licences remain valid
under their original policies.

The private worker processes grants, revocations and retryable SMTP delivery.
SMTP response loss can cause duplicate delivery of the same unexpired code.
Resend is rate-limited and does not disclose whether an email exists.

Build with `python3 scripts/build_membership_update.py`. The resulting ZIP is a
separate installation deliverable. Extract beside public_html, run the CLI
`php install.php` preflight, then `php install.php --install` only after READY.
The installer checks the supplied hosting baseline and all payload hashes,
backs up the activation database and changed files privately, and preserves
configuration, vault and progress. A changed or already updated host stops for
review. Keep the private backup. Web and CLI PHP both require PHP 8.2+, PDO SQLite,
Sodium and OpenSSL. Legacy Gumroad additionally requires cURL.

After installation configure a periodic private task:
`php worker.php CONFIG_PATH`
Only after checking actual credited bank funds, the owner may run:
`php worker.php CONFIG_PATH confirm-transfer ORDER_ID BANK_REFERENCE USD AMOUNT_IN_CENTS`
The unique bank reference, amount and currency are validated. No bank feed exists.

Membership routes are enabled by the package's private features.php. Transfer
collection remains disabled, as does public checkout. Existing explicit config
flags take precedence. Do not use the historical Gumroad prices for new plans.

Local tests use real signatures, RSA wrapping and private SQLite, with fake mail
and bank confirmation. They do not prove live hosting, SMTP, physical browser
compatibility or actual bank connectivity. Real email, scheduled worker, two-device
sync, institution removal, live-transfer copy and invoice/support workflow remain
pre-collection checks. Card processing and FX display remain disabled.
