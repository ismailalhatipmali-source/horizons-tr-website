# Public contacts and owner-assisted activation

## Contact update

The owner confirmed +905522268840. The contact release updates all 192 affected
pages in 32 locales and describes three public addresses:

- info@horizons-tr.com: general enquiries and purchases.
- support@horizons-tr.com: technical support and activation.
- privacy@horizons-tr.com: privacy and personal data requests.

cPanel inspection on 2026-10-02 found info as an unrestricted mailbox; support,
privacy, legal and security were absent, with no forwarders and an unknown-user
rejection as the default address. All four aliases now forward to the existing
company info mailbox. The two older addresses remain receivable for compatibility.
These aliases do not have separate inboxes or sending credentials. Replies can be
sent from the existing info account.

cPanel reports DKIM, SPF, DMARC and reverse DNS as valid. This verifies configuration,
not an external end-to-end delivery test or guaranteed inbox placement. No customer
messages or live activation codes were sent during this task.

`scripts/update_contact_details.py` maintains the localized contacts and is called
by the commerce builder. `scripts/deploy-contacts.php` publishes only the 192
approved contact pages with whole-release baseline checks, private backups,
rollback and idempotence. The manifest is under `release-assets/contact-20261002`.
Validation used all actual pages, rejected an unexpected live edit before writing,
verified every resulting hash and backup, preserved learner data, and repeated the
deployment without changes. Workbook release remains 1.4.5; payment flags remain off.

## What an activation code means

Payment grants server-side rights to a buyer email: account type, plan, start/end,
group and learner capacity. The email code does not itself encode or choose a plan.
It is an eight-digit one-use code valid for ten minutes; email plus code must match
an active entitlement. Five failed attempts invalidate the attempt budget. Code
verification consumes it and opens a separate short-lived password-setup step.
Later sign-in uses the same email and password on any device.

Individual: one learner identity. Family: owner plus four permanent invited
learner emails, each with its own code/password/progress. Institution: separate
administrator and up to 100 learner identities; annual access, with removal and
replacement supported. Multiple devices on one account are not extra learner seats.
The system cannot prove that a password has not been shared by the account owner.

## Owner-assisted activation: existing implementation and limits

There is no deployed administrative web dashboard or public code generator.
Do not create arbitrary codes, edit entitlement tables manually or reuse the old
three-device/Gumroad licence workflow for the current membership plans.

For an existing transfer order, after checking actual credited funds against the
customer email, account type, plan, exact amount, currency and unique bank receipt,
an authenticated hosting administrator can use the existing private CLI:

```text
php worker.php CONFIG_PATH confirm-transfer ORDER_ID BANK_REFERENCE USD AMOUNT_IN_CENTS
```

Run the worker in the installed private activation service, with the existing
private config path. This validates the receipt, fulfils that order's stored plan,
then queues and sends the owner's code using the configured mail service. The
periodic worker retries pending deliveries. Repeating the same confirmation does
not create another membership; reusing a receipt for another order is rejected.

Collection is currently disabled in public and private configuration, so this CLI
is not an available live sale shortcut yet. A customer email alone is not an order.
There is currently no owner form/command for entering a new off-site sale through
the complete billing-and-consent flow. Enablement and a real payment-to-mail test
must precede live fulfilment. Never invent an order or receipt to demonstrate it.

For an already entitled customer, the activation screen's resend operation queues
a code to the same registered email, rate-limited to three requests per hour per
email. An expired activation code does not remove the paid entitlement. Code resend
can lead to password reset, so keep the recipient unchanged and let the customer
set their own password.

Recommended next owner workflow: a protected administration screen with customer
email (confirmed twice), account type, plan, order/reference and verified payment,
then an explicit confirmation to grant/resend through the same backend. Include
owner authentication, audit history, duplicate-receipt protection and clear
delivery status. This is a proposal, not a claim that the screen already exists.
