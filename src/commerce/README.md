# Account commerce — prepared integration

| Account | Learners | Monthly USD | Annual USD | Lifetime USD |
| --- | --- | --- | --- | --- |
| Individual | 1 | 9.99 | 99 | 150 |
| Family | 5 including owner | 20 | 200 | 250 |
| Institution | 100, administrator separate | — | 1,000 | — |

Tax-inclusive prices; Level 1 updates included. No automatic recurring charges.
The 32-language website uses a persistent floating basket and browser-first
start → demo or account → basket → billing review. Country/territory and dependent
city suggestions use local data, with manual city entry. Buyer details remain in
page memory in review mode. Permanent individual/family emails need explicit
acknowledgement and repeated email confirmation. Institution seats can be removed
and replaced only after the issuer confirms access revocation.

Collection is OFF in the public catalogue and private installer feature flag.
The transfer endpoint and UI are ready behind both flags. Orders settle in USD
using server prices. Billing is encrypted outside public_html. A browser assertion
cannot confirm payment: only the owner-only CLI can confirm actual bank credit,
matching order, amount, currency and a unique bank receipt. It then fulfils the
owner and queues activation mail. Card and exchange-rate conversion are off.

Each learner gets a one-use code, sets a password, and later signs in from any
device with a separate account/progress identity. Family invitations are permanent,
including pending ones. Institution removal cancels pending delivery and blocks
online requests; disconnected access ends within the 24-hour offline licence lease.
Renewal extends the existing group and learners, preserving lifetime access.
Existing learner assignment or owner account-type changes require support before
another purchase; duplicate lifetime terms are rejected.

Tests cover paid-before-access, encrypted storage, unique bank receipts, retry,
five distinct family identities, institutional capacity/revocation, renewal,
actual cryptographic activation, six device identities, schema-4 progress, and
legacy compatibility. All mail/bank adapters in tests are fake. The ZIP installer
was tested for dry-run, backups, unchanged config/vault/database/progress, and
rejection of changed host sources or damaged payloads. The deployment script
passed 22 preservation/failure cases. Browser compatibility needs real-device checks.

Before collection: install and test the private service; schedule the worker;
verify real mail and two-device sync; complete live order copy, invoices/refunds
and guardian/learner privacy wording. The public site retains review-only copy.
This branch and its local tests are not a claim of live deployment or live bank/SMTP.

Build: `python3 scripts/build_commerce_review.py`.
Package: `python3 scripts/build_membership_update.py`.
See ../activation/README.md for the private installer and worker.
