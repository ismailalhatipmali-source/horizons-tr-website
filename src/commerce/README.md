# Account checkout and private membership preparation — 1 October 2026

## Implemented website behavior

All 32 languages support browser-first **start → free demo or account selection
→ basket → billing preview → order review**. The floating cart appears on every
localized public website page, retains a single selected account/term across
navigation and browser sessions, and updates across tabs. Only account/product,
term and quantity are persisted. Existing learner/license storage is untouched.
The old session basket migrates to an individual account. Unsupported combinations
(including institution monthly/lifetime) cannot be selected by forged URL/storage.
The separately released workbook/demo are not rewritten by this site build.

| Account | Learners | Monthly USD | Annual USD | Lifetime USD |
| --- | --- | --- | --- | --- |
| Individual | 1 | 9.99 | 99 | 150 |
| Family | 5 including purchaser | 20 | 200 | 250 |
| Institution | 100, administrator separate | — | 1,000 | — |

Totals include taxes; no additional tax is added. No automatic renewal. Level 1
updates/additions/fixes are included; future workbook levels are separate products.
The permanent-email warning precedes purchase review and requires a separate
explicit checkbox for individual/family. Buyer email must be entered twice.
The preview confirmation does not reserve an email or create an order.
Institution administrators can replace learners; individual/family membership
emails cannot be replaced through the application. Statutory erasure requests
must still have a support process; seat permanence is not a claim to retain
personal data against applicable rights.

Country/territory suggestions and dependent city search load from the site's own
`assets/commerce-geo/`. The derived ODbL database includes 250 country/territory
labels and 141,442 distinct city labels per country. Names are suggested in the
interface language using Intl.DisplayNames; city Arabic labels are used where
available. Manual city entry remains available for missing localities/offline
loads. Previous city selection clears on country change; late responses cannot
restore a previous country's cities. No geolocation, third-party request, API key
or buyer details are involved. Data licence, attribution and pinned source revision
are publicly distributed alongside the data. Maximum 100 filtered city suggestions
are rendered at once; other matching cities appear as the user types.

**Payments remain disabled.** Card is visibly unavailable, bank transfer is the
selected review method, and the three owner-supplied corporate IBANs remain visible
in order review. This release creates no live order/invoice and grants no access.
Buyer details stay in page memory only and are never placed in storage, URLs,
analytics or SMTP. No-JS forms stay disabled. Text nodes prevent HTML injection.
Terms acknowledgement does not waive withdrawal rights or authorize early delivery.

## Private membership integration boundary

`PurchaseLedger.php` records account type and approved server prices, confirms
an exact bank sale, and queues a unique fulfilment/mail job. No production bank,
manual-transfer HTTP service, payment adapter, SMTP worker or invoice service is
included. Internal code is not deployed to public_html by cPanel. Tax invoice
configuration and refund/reversal/reconciliation remain prerequisites for sales.

`MembershipLedger.php` implements private encrypted membership storage and an
issuer adapter contract, not a live account service. It accepts only a durable
paid/access-ready order from PurchaseLedger, preserving the acknowledged owner's
stable account ID. Family owners occupy one seat, plus four permanent invitation
slots. Pending invitations count against the limit. Institution administrators
are separate from the 100 learner seats; administrators may invite their own
email as a learner if needed. Group expiry is derived from the original paid_at
and term; all learner grants inherit that expiry, not a new year per invitation.
Emails are confirmed before invitations and encrypted with a separate private
32-byte Sodium key. Only keyed email hashes are indexed. Losing the key loses
access to stored emails; a changed key fails closed. Back up the private database
and key together. Do not put either in GitHub or public_html.

Actors come from verified server authentication; never accept an account ID from
a browser as an authorization claim. Only the paid group owner administers its
roster. Family seat assignment is permanent even while an invitation is pending.
Institution removal first enters `removing`; the slot is not freed until the
private issuer confirms membership revocation. Revocation must cancel pending
invitations, online sessions and that learner's group access without erasing an
unrelated personal purchase. Grants/revocations are idempotent by member_id.
Issuer response loss retries the same grant instead of creating another learner.
Issuer grants may not collapse distinct emails into one progress identity.

`membership-manager.js` is a tested integration UI component accepting injected
`list/invite/remove` functions. It is intentionally not mounted or deployed into
the existing workbook before authenticated backend integration. Individual accounts
hide invitations; families have no remove button; institution removal needs a second
explicit confirmation. It never stores learner emails or displays reusable codes.
Each invited learner verifies their email, sets their own password, and owns a
separate account/progress identity. First-activation codes are one-use; subsequent
login uses email/password, with account recovery through email verification.

### Concrete remaining dependency

The private `/activation` application's source/configuration interface is absent
from this Git repository and the attached September 23 educational archives.
The current issuer still grants paid licences for **3 devices** and trials for
**1 device**; the client and progress verifier retain their existing signed licence
contract. No client-side bypass or fabricated unlimited-device licence is added.

Before sales, adapt and test that private issuer to preserve trial passwords,
registered identity and progress; issue unlimited device registrations per learner;
verify group membership on every login/progress request; expose authenticated roster
operations; and integrate queued invitation/activation email delivery. Revocation of
institution access on offline devices requires a bounded offline licence lease;
the existing lifetime offline signature cannot provide immediate offline revocation.
Annual renewal must extend the existing institution group without replacing its
learners or owner identity. Server checks must enforce eligibility/expiry beyond
what the UI displays. Reset-password/device and real two-device sync tests remain
necessary. Guardian-controlled email accounts/consent and the current privacy and
child-safety wording need to be reconciled with independent learner sign-ins before
this model is enabled. No child-identifying fields are added to the purchase form.

## Verification

- 64 cart/checkout DOM pages, 224 account/term choices, 192 public-page persistence checks.
- Confirmation/consent, individual/family permanence and institution annual-only policy.
- Searchable dependent location data, late-response protection, manual city fallback.
- Fake-issuer private tests: paid-before-access, family 5/institution 100, encrypted
  emails, owner isolation, duplicate invitations, response-loss retry, shared expiry,
  and revocation acknowledgement before seat replacement.
- Standalone roster UI tests with injected test adapter; **not live SMTP/activation**.
- 22 unchanged cPanel deployment regressions; website rebuild is idempotent.

Build: `python3 scripts/build_commerce_review.py`.
Node: `node tests/test_commerce_dom.mjs`, `node tests/test_location_picker.mjs`,
`node tests/test_membership_manager.mjs` (jsdom).
PHP: `php tests/test_membership_ledger.php` (PHP 8.2+, PDO SQLite, Sodium).
Browser: `node tests/test_commerce_browser.mjs` (Playwright/Chromium, local preview).
Physical Safari/iPhone, Android and Windows tests and production delivery must not
be inferred from DOM/fake-adapter tests.

Current environment verification limit: local Chromium cannot start because the
execution environment rejects its Unix sockets (`socket() failed: Operation not
permitted`). A browser screenshot/mobile layout pass has **not** been obtained
for this change. DOM and fake-issuer results above are independent of this limit.
