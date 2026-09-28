# Account progress API

PHP 8.2+ with PDO SQLite, Sodium and OpenSSL. The deployment puts this directory at `/learning-api/`. The browser uses HTTPS `POST /learning-api/index.php` with JSON `{action, ...fields}`. No new SMTP setup, email code, payment service or activation migration is required.

The bootstrap reads the existing activation configuration path from the trusted `HORIZONS_LICENSE_CONFIG` server environment, or `/activation/config-path.php`, or `/activation/config.php`. It reads `enabled` and `database_path` only. It **does not load the activation application**, the owner vault or SMTP services. The activation database opens with SQLite's read-only flag and `query_only=ON`.

On first request, it creates `horizons-learning` beside `public_html`, outside the document root, with directory mode `0700`, a randomly generated `key.bin` (`0600`) and `progress.sqlite` (`0600`). Initialization is locked; a missing or changed key for an existing database fails closed. Back up this private directory together. Losing the key makes saved cloud progress unreadable. Deployment leaves this directory and the activation configuration untouched.

## Authentication

1. `auth-challenge` takes `{license:{payload,signature},public_key}`. The license must verify against the pinned Ed25519 issuer, match the supplied RSA public key, be current and match the active registration. Both the entitlement's device and the account's direct-license device record are checked. Legacy schema 2 account identity comes from the existing registry, never a browser-provided account ID.
2. The response includes `challenge_id`, `encrypted_nonce`, `expires_at` and `account_id`. The client decrypts the nonce with its nonextractable activation private key using RSA-OAEP SHA-256 and label `horizons-arabic-level1/progress-auth`.
3. `auth-verify` takes `{challenge_id,nonce}` with the plaintext nonce in standard base64. The challenge expires after 60 seconds and is consumed on the first attempted response. The result includes a random `token`, `expires_at` and `account_id`.
4. Other actions send `Authorization: Bearer <token>`. Sessions last at most 15 minutes and never exceed the signed license expiry. Every authenticated operation rechecks current entitlement expiry/revocation and current device registration. Possession of a signed license alone cannot read or write progress.

Tokens are hashed in storage; authentication claims and learning documents are encrypted with Sodium secretbox. Rate limit identifiers are keyed hashes, not raw IP addresses. Cross-site browser requests and non-JSON mutation requests are rejected. There are no credential URLs or CORS allowances.

## Profiles and conflicts

Responses include `{ok:true,account_id,...}`. All account scoping comes from authentication. Supplying an `account_id` in a progress request is rejected.

| Action | Fields | Response |
| --- | --- | --- |
| `list` | optional `cursor` | `profiles` containing only IDs, revisions and optional deletion times; next `cursor` or `null` |
| `get` | `id` | complete `profile` or tombstone |
| `put` | `id`, `base_revision`, `operation_id`, `consent:true`, `nickname`, `settings`, `progress` | saved `profile` |
| `delete` | `id`, `base_revision`, `operation_id` | deletion tombstone `profile` |

Profile and operation IDs are lowercase 32-character hex. Initial creation uses revision `0`; each successful mutation increments the revision. A stale revision receives HTTP 409 `REVISION_CONFLICT` with the current `profile`. A repeated operation does not write twice. Replays return the **current** authoritative profile, `replayed:true`, and the originally accepted `acknowledged_revision`; another device may have advanced or deleted that profile in the meantime. The client preserves conflicting local work for explicit resolution.

The operation ledger stores hashes and acknowledgement revisions, not old learning snapshots. It retains at most 5,000 operations per account for up to 30 days. Beyond that, revision comparison still prevents stale retries from overwriting current data. Tombstones have no nickname or learning payload and prevent deleted profiles from being recreated by a delayed device. List pagination includes tombstones. Limits: 50 active profiles, 1,000 total profile IDs, 50 records per list page, and 256 KiB per request.

Cloud saving is an explicit choice for each learner profile by the activated account user. `consent:true` records that choice; it is **not** age or parental-authority verification. The UI asks for a pseudonym and explains what is uploaded. Ink strokes and local recovery copies stay on the device.

## Minimal learning document

- `settings`: `locale`, `meaningLocale`, `typography` (`schemaVersion`, `font`, `size`).
- `progress`: the existing workbook schema/book/content identifiers, audio revision, locale, course/chapter/current position, alphabet mode, selected letter, meaning/guide preferences, `heard`, `attempts`, `written` and chapter `bookmarks`.
- Every field, enum, numeric bound and map key is validated against the current workbook schema. Unknown fields are rejected. Ink, images, audio, free-form lesson text, email, phone and device telemetry are not accepted in this projection.
- Deletion erases the encrypted profile payload. A minimal opaque tombstone remains so offline devices cannot restore the deleted copy. User-managed hosting backups have their own retention period.

Expected errors use a stable code and optional `field`; internal paths, SQL, credentials and raw exception messages are not returned. A hosting/setup fault returns `SERVICE_UNAVAILABLE`; local learner saving continues independently.

## Tests

Run `PHP_BIN=/path/to/php python3 tests/learning-api/run-tests.py` from the repository. It creates only temporary synthetic registries, signing keys and learner data. The tests cover account isolation, cross-device access, CAS/replays/deletion, projection/consent/size checks, challenge replay and expiry, activation database immutability, revocation/key rotation, encrypted storage, fail-closed private initialization and rate limits. Node WebCrypto independently decrypts the PHP-generated OAEP challenge and rejects a different label.
