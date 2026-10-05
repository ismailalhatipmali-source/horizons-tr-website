# Maintenance record — 2026-10-05

## Verified baseline

- GitHub main and the cPanel live checkout both displayed commit
  `30ea91bc1a9d763722a8b581511c6018a8cdcbe6` before changes.
- Live checkout: `/home2/horizonstr/repositories/horizons-tr-website-live`.
- A separate focus-review checkout also exists. Its deployment and local changes
  were not inspected, and it was not removed.
- The remote main tree had 2,473 tracked files, including 705 release asset files
  (1,502,922,644 bytes), 1,457 dist files (78,453,257 bytes), and 149 source files.
- `.cpanel.yml` runs ordered PHP publishers, not the historical base installer on
  every update. Private inputs and receipt baseline folders participate in its
  checks. Removing duplicated-looking files could break future deployment.
- The cPanel File Manager showed the existing private quarantine at
  `/home2/horizonstr/.horizons-site-quarantine-20261005` with mode `0700`, and
  `public_html/images` with mode `0755`.
- `public_html` still contained `index.php`, `application`, `system`, `ckeditor`,
  `phpstorm.php`, `maintenance.php`, `.idea`, `user_guide` and older asset folders.
  These are candidates for investigation; name/date alone does not prove that
  they are unused. No hosting files were moved in this pass.

## Changes in this pass

- Replaced nine references to `/tmp/horizons-demo-tools/package.json` in DOM
  tests with dependency resolution relative to each test file.
- Added local-only `tests/package.json` and a lockfile with the existing JSDOM
  dependency. `npm ci --prefix tests --ignore-scripts` makes the tests repeatable
  without a directory left behind by an earlier conversation.
- Preserved the two earlier schema-2 commerce/geography tests under
  `tests/archive/`, with their contract documented. Their active replacements
  load the actual schema-3 basket and integrated checkout geography; they test
  all available offers, legacy basket migration, local city data and stale
  response protection. Historical source modules remain for the base build.
- Added an isolated backend regression proving that both the default and an
  explicit false trial setting reject a new automatic trial after a valid OTP,
  including forged browser fields. This does not verify the hosting config.
- Corrected the README's current-vs-historical deployment guidance and clarified
  the full trial pause, separate demo, private receipts, and base release marker.
- Added `scripts/audit-site.php`, a CLI-only inventory. It writes reports only
  into a new private directory beside `public_html` (directory `0700`, reports
  `0600`), never includes inspected PHP, never follows symlinks, never opens a
  customer database, and does not export configuration values or raw log lines.
  Synthetic tests cover those boundaries and refusal to overwrite reports.

## Verification completed

- 114 public GET checks: 110 responses were 200; `/fileman/` and the public
  quarantine URL were 404; the two POST-only activation/learning probes correctly
  returned 405. The 32 localized home/product/checkout routes responded. HTTP
  availability alone does not prove browser behavior or authenticated success.
- `/learn/?lang=ar` and the current 32-language locale JSON contain the paused
  full-trial message; `/try/` remains available. The private trial flag is pending.
- 22 isolated base-deployment preservation/failure/rollback tests passed.
- 12 current DOM regressions passed, covering 32-language buyer forms, policies,
  account interfaces, currency, basket persistence and local geography.
- 2 isolated inventory safety tests passed. Local signed activation, fake-mail
  retry, password setup, multi-device membership and revocation checks passed.
- The backend trial-pause regression passed. These use generated keys and
  temporary databases; no real purchase, account or email was created.
- PHP syntax checks passed for all 82 local PHP files. Four high-specificity
  token/private-key patterns had no matches in 1,513 repository text files below
  4 MiB. This excludes Git history, host configuration and unknown secret formats.

The complete historical binary build, encrypted-media mapping and authenticated
live workflows were not verified. No claim of a full production rebuild or
successful hosting publication is made.

## Private inventory command

Run only from the private live checkout, with the host's PHP CLI:

```sh
/usr/local/bin/ea-php82 scripts/audit-site.php \
  /home2/horizonstr/public_html \
  /home2/horizonstr/.horizons-audit-20261005-r1
```

This command was validated against synthetic local fixtures, **not executed on
the hosting account in this pass**. Do not place the script or its output in
`public_html`. It is not added to `.cpanel.yml` and does not create a cron job.
Choose a new report directory on a later run; existing reports are preserved.

The output includes path/size/mtime/mode inventory, executable candidates,
literal legacy references from public and selected private code, known evidence
hashes, and bounded access-log counts without IPs or query strings. Heuristic
matches are investigation leads, not proof of compromise or proof of non-use.

## Source preservation

The supplied source map is dated 2026-09-23 and is partially historical. The R5
archive was retrieved for review; its `audio-index.json`,
`scene-index-source.json`, and `course.json` remain the content reference. The
file catalog also resolves `27_WAAW.wav` and `28_YAA.wav` and complete female
audio archives. No words, sentences, stories or recordings were replaced.
Mapping every later image/audio archive to the encrypted live release remains
unfinished and must precede any media pruning.

## Hosting access limit and outstanding work

Browser authentication succeeded and cPanel observations above were obtained.
The browser's native credential protection then prevented downloading the
Apache rules and resuming that browser runtime. This is an access/tooling limit,
not evidence that the website or cPanel service failed.

The following remain unverified: recursive hosting inventory, checkout dirty
state, final deployment receipt/log, current cron definitions, private config
trial flag, five suspicious file evidence hashes and access-log indicators,
legacy dependency absence, server-side credential exposure, authenticated admin
and learner flows, and reversible quarantine of unused hosting components.
Do not claim that the host is clean or that compromise is confirmed.

## Rollback and continuation

This commit does not change `.cpanel.yml`, public payloads, runtime configuration,
customer data or published product content. Reverting it restores only the test
harness, documentation and inventory utility. Reconnect cPanel, read the private
audit results and deployment/cron state, then use an explicit path-and-hash
manifest for any reversible move. Keep Trash, access logs, private receipt
baselines, product sources and customer databases intact.
