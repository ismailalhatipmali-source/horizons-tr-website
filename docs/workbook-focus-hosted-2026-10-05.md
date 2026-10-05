# Workbook focus UI: hosted verification

Date: 2026-10-05. Timezone: Europe/Istanbul.
Application source: `d091bb3d4ae603c3cfb86c1f8083dedfefa7f633` on `ui/workbook-focus-2026-10-05`.
Release: `workbook-focus-20261005-r1`.

## Publication

The reviewed checkout at `/home2/horizonstr/repositories/horizons-workbook-focus-review` first ran the default read-only deployer against `/home2/horizonstr/public_html`. It returned:

```text
READY: six UI targets verified, reversible player transformation, content manifests preserved; no files written.
```

This verified the actual current B4/CM/B3/B2 receipt chain and encrypted-player transformation. The subsequent explicit `--publish` invocation completed at 11:29 and returned:

```text
PUBLISHED: focus UI; educational assets and prior receipts preserved. Verify browsers and licensed audio before declaring completion.
```

Only the six focus targets were published. The full cPanel pipeline was not invoked. All three temporary focus Cron Jobs were removed afterward; the existing backup and membership worker jobs remained. GitHub `main` stayed at `b737a92`; no main merge was performed.

## HTTP verification

HTTP checks retrieved all six new target files, including the encrypted player and updated manifest. Comparison of each manifest showed that only its `workbook.js` entry changed. The other 594 demo entries remained identical; the previously documented 497 teaching/media entries are a subset of that total. The downloaded paid encrypted player matched its live manifest SHA256. The session evidence is recorded in `audit/hosted-focus/http-verification.json` outside the repository. Recorded public hashes include:

| Path | SHA256 |
| --- | --- |
| `try/workbook.js` | `623d60b81455d790da1bd4015f8e828c2c597672fcfde9b63e9707982cd1f572` |
| `try/sw.js` | `4cd2611ca44f3cc26730e957509fe151bb80cdfea8c192e623fe82dc9549e8d7` |
| `learn/sw.js` | `951593ecb7ea7dcaa95bb6fd78fd61ccc86cf075ea0cb96434617686a1b97bc5` |

HTTP publication checks establish what the server serves; they do not by themselves establish what a previously cached client is using.

## Browser observations and limits

| Check | Observed result |
| --- | --- |
| Fresh `https://www.horizons-tr.com/try/?lang=ar` | New focus interface displayed; Baa lesson images loaded; Next navigation worked; no horizontal page overflow observed; word and sentence recordings completed and visible listening progress advanced from 0 to 1 of 20 |
| Existing `https://horizons-tr.com/try/?lang=ar` browser | Old interface persisted with an update-available notice, including after closing application tabs; production cached-client migration remains unverified |
| `https://horizons-tr.com/learn/` | Activation/password form loaded; no valid licensed browser credentials were available for full application checks |
| Local update/offline test | Previously passed: new cached player hash, unchanged learner progress, word3 resume and offline image/audio without network requests |

The www and no-www hosts are separate origins with separate local storage and service-worker registrations. Fresh-origin verification is not a migration workaround for existing learners and does not prove their progress transferred. No learner storage was cleared as an update workaround.

The demo worker deliberately waits for old controlled pages to close before activating. Its local regression test closes the old page, parks outside `/try/` until activation completes, then reopens the application. It does not clear caches or unregister the worker. The production cached-browser observation above remains unresolved and is not overridden by that local pass.

Full licensed interaction, real learner isolation, licensed audio and licensed cached/offline transition require valid authorized access. They have not been claimed as passed. The local browser matrix and synthetic-profile checks remain useful but do not substitute for those checks.

Recovery scope, immutable receipt checks and the protected rollback procedure remain in [workbook-focus-deployment.md](workbook-focus-deployment.md).
