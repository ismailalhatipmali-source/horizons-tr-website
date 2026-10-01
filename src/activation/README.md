# Activation source recovered from hosting

The five source files supplied by the owner on 2026-10-01 are retained here as
the production integration baseline. No configuration, signing vault, database,
SMTP password or private key is included. The public entry point is still the
separate hosted `/activation/index.php`.

`MembershipBridge.php` adds private, encrypted membership rights to the actual
issuer's account database. It preserves existing account IDs/passwords and
queues one durable delivery record per learner. Grant retries validate all
immutable terms; revoked grants cannot be resurrected. Revocation affects only
the membership and cancels a pending delivery, preserving other purchases.

This is a **draft storage integration**, not a production-enabled issuer. It is
not loaded by bootstrap or called from public HTTP routes. Delivery processing,
membership activation codes, password setup, any-device signed licences,
bounded offline expiry, membership-aware session checks, owner payment
fulfilment, renewals, and workbook UI integration remain to be completed and
tested together. Do not wire it into the membership worker or enable collection
until those checks exist. It currently emits no licences or emails.

The imported baseline still prices the old monthly adapter at USD 9.90 and
enforces the old three-device policy. New commerce prices are separately correct;
do not use the old Gumroad adapter for new bank orders.
