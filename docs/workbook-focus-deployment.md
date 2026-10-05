# Workbook focus UI: deployment and recovery

Release: `workbook-focus-20261005-r1`.

This release changes the presentation of the existing demo and licensed workbook. It preserves the existing course, licence/device rules, learner database, progression keys, recordings, images and fonts. It does not deploy checkout, pricing, administration, account credentials or new educational content.

## Exact publication scope

The deployer permits only these six existing public targets:

| Target relative to the verified web root | Change |
| --- | --- |
| `try/workbook.js` | Shared focus shell plus three reversible demo status changes |
| `try/demo-asset-manifest.json` | Updated hash and size of the demo player only |
| `try/sw.js` | New UI cache suffix and recognition of that suffix |
| `learn/content/1.4.1/workbook.js.hzn` | Generic shell and B3/B4 renderer/styles, patched inside the existing encrypted application |
| `learn/asset-manifest.json` | Updated encrypted player hash, size and decoded size only |
| `learn/sw.js` | New UI cache suffix only |

All other demo manifest entries must compare identically. The 497 demo teaching/media manifest entries remain unchanged. Paid manifest fields and groups must compare identically after projecting the player entry back to its original value. The paid application version remains `1.4.6`; the new UI is identified by its release receipt and worker suffix.

The paid player is decrypted only on the authorized host using its existing private vault, transformed through exact unique hooks, reverse-checked, compressed and encrypted again. No vault key or decrypted workbook belongs in Git, screenshots or test reports.

## Sources and historical verification

Successor inputs live in `src/workbook-focus/`. Earlier pinned application source files and release manifests remain immutable. The historical comprehensive-meaning preservation source is retained byte-for-byte at:

`release-assets/workbook-focus-20261005-r1/predecessors/comprehensive-meaning-preservation.php`

The B4 resolver verifies that historical snapshot against the original B4 source pin, and verifies the current bridge against the new release source pins. Existing private receipts are never rewritten. The new private state is a sibling of the web root:

- `.horizons-workbook-focus/receipt.json`
- `.horizons-workbook-focus/baseline/<public-relative-path>`

The directory must be `0700`; its receipt and backups must be `0600`. Published targets remain `0644`. The receipt binds both predecessor receipt bytes, all six original/current file hashes, original modes, new source hashes, release-manifest hash and before/after plaintext player hashes.

## Reproduce the local deployment gate

Run from the repository root. This session's portable PHP runtime is outside the repository and is not part of the release. Use a PHP CLI with OpenSSL and zlib on PATH, or set HZN_TEST_PHP to its absolute executable path. Install jsdom in the local QA environment before running the shell test.

```bash
python3 scripts/build_workbook_focus.py
python3 tests/test_workbook_focus_deploy.py
```

The test suite contains 16 cases, covering PHP syntax, matching the actual public demo transformation to the builder, immutable historical source resolution, generic B3/B4 transformation, encryption/authentication, transaction success, failures after each of the six writes, verifier-failure rollback, two concurrency cases, private-state conflicts, symlinks and a rejected dry run with no filesystem writes. A missing PHP runtime produces explicit skips; skips are not acceptance.

The shell DOM/state contract test is separate:

```bash
HZN_JSDOM_PATH="$PWD/node_modules/jsdom/lib/api.js" node tests/test_focus_shell.mjs
```

Rebuild and rerun the gate after any pinned source change. A stale manifest must fail `FOCUS_SOURCE_CHANGED`; do not remove that check to make the tests pass. Record the tested manifest SHA256 and source hashes with the results.

These tests do **not** prove that the current licensed application and its complete private server receipt chain work. The paid component transformation fixture is explicitly synthetic. Public-demo browser checks, licensed browser checks and real private-chain staging verification are independent acceptance gates. A successful Git push is also not evidence of hosting publication.

## Before any hosting publication

1. Verify the actual repository, web root, current HEAD and hosted release. The previously known web root is `/home2/horizonstr/public_html`; do not assume a different account has that path.
2. Use an authorized staging copy of the current application and receipt chain. Keep private receipts, encrypted backups and the vault outside the staging public root. Use isolated test learners. Do not copy production learner databases into a public fixture or expose credentials.
3. Verify the existing complete B4/CM/B3/B2 chain, run the new deployer's default dry run against that staging root, then publish only to staging. Test its automatic failure recovery there.
4. Complete licensed full-workbook browser QA: all six sections, activity gates, audio, learner isolation, settings, resume/history, writing/rotation, update/offline behavior and the required viewports. Check the demo independently.
5. Review the complete diff and compare upstream HEAD again. Confirm every historical cPanel task remains. Save a recovery copy and keep the final release hash in the deployment record.

From the repository root, these commands illustrate the two distinct operations. Replace the example staging root with its verified absolute path:

```bash
/usr/local/bin/ea-php82 scripts/deploy-workbook-focus.php /home2/horizonstr/staging-public
/usr/local/bin/ea-php82 scripts/deploy-workbook-focus.php /home2/horizonstr/staging-public --publish
```

The first command performs validation and prepares the encrypted transformation in memory without creating a lock, receipt, directory or public file. It must report `READY` before the second operation. `--publish` is the only CLI argument that enables publication.

The production task stays **last** in `.cpanel.yml`, after B4. Keep all preceding tasks. Do not run that task or the full cPanel pipeline until the private-chain and licensed-browser gates pass. The full pipeline also includes unrelated tasks; it is not a harmless UI dry run.

On publication, the deployer locks its own transaction, rechecks concurrent file/receipt changes, writes both players, both manifests, then both workers, and validates the resulting receipt and every predecessor. Repeating an already verified installation reports `CURRENT` without changing files. Any interrupted, unexpected or conflicting state must be investigated, not accepted by editing stored hashes.

After actual production publication, verify `/try/` and authorized `/learn/app/` on the hosted origin, both manifests/workers, navigation, audio and a previously cached client. Record hosting verification separately from build/test/Git status. Never clear learner storage as an update workaround.

## Automatic recovery versus deliberate rollback

The deployer automatically reverses its own writes when publication or final verification fails. It restores original bytes and modes only while each target still matches the bytes/mode written by that transaction. A later external edit is preserved; backups remain and the deployer reports `FOCUS_RESTORE_REQUIRES_ATTENTION`. Do not retry publication over that state.

There is no post-publication `--rollback` CLI. Deliberate rollback therefore requires a controlled administrator procedure. Rehearse it on the authorized staging copy before production. Do not substitute an unreviewed recursive copy command.

### Read-only chain checks

Run these from the exact reviewed repository on the authorized host, with its verified web root. They load the deployer's function library without executing its CLI publication path. These are validation commands, not a rollback command.

Before deliberate rollback, require an installed focus receipt:

```bash
/usr/local/bin/ea-php82 -r 'define("HZN_FOCUS_DEPLOY_LIBRARY_ONLY",true); require "scripts/deploy-workbook-focus.php"; if(hznFocusState($argv[1])===null)throw new RuntimeException("FOCUS_RECEIPT_REQUIRED"); hznFocusChain($argv[1]); echo "Installed focus and predecessors verified\n";' /home2/horizonstr/public_html
```

After all six files have been restored and the focus private directory archived, require its active receipt to be absent and the predecessor chain to pass:

```bash
/usr/local/bin/ea-php82 -r 'define("HZN_FOCUS_DEPLOY_LIBRARY_ONLY",true); require "scripts/deploy-workbook-focus.php"; if(hznFocusState($argv[1])!==null)throw new RuntimeException("FOCUS_RECEIPT_STILL_ACTIVE"); hznFocusChain($argv[1]); echo "Restored predecessor chain verified\n";' /home2/horizonstr/public_html
```

Do not invoke older deployment scripts as read-only checks: some publish without a `--publish` argument.

### Protected manual rollback procedure

1. **Stop concurrent deployment.** Pause deployment triggers and arrange a maintenance window so no cPanel task, other deployer or administrator writes these targets. Keep `.cpanel.yml` intact, with the UI task last. An ordinary future pipeline run would otherwise reinstall this UI; keep triggering paused until the replacement or recovery is approved and tested.
2. **Authenticate the rollback point.** Inspect the new private receipt through an authorized administrative session. Require its schema/release, exact six-file scope, source/release hashes and predecessor receipt hashes to match. Validate the installed focus state and predecessor chain with the same checked-out release. If either fails, stop for investigation; never make the receipt match an unknown current file.
3. **Check all bytes and permissions before writing.** For each table row, require the current public file SHA256 to equal `receipt.hashes[path]`, current mode to be `0644`, backup SHA256 to equal `receipt.before_hashes[path]`, backup mode to be `0600`, and recorded original mode to be `0644`. Reject symlinks at every path segment. Confirm the `.horizons-blending4/receipt.json` and `.horizons-comprehensive-meaning/receipt.json` hashes still equal `receipt.inherited_receipts`. The old receipts must remain unchanged throughout recovery.
4. **Retain both recovery directions.** Create a uniquely named, private recovery archive outside the web root. Preserve the entire focus private directory, including its receipt and baseline, plus the current six public files and their modes/hashes. Archive directory mode is `0700`; archived files are `0600`. This archive allows recovery if deliberate rollback is interrupted. Do not overwrite an earlier archive.
5. **Restore only the six verified baseline files.** Restore in this order: `try/workbook.js`; `learn/content/1.4.1/workbook.js.hzn`; `try/demo-asset-manifest.json`; `learn/asset-manifest.json`; `try/sw.js`; `learn/sw.js`. For each file, recheck that the live bytes/mode still equal the receipt's current hash/`0644`, copy its baseline to a temporary sibling, set the recorded original mode, verify the temporary SHA256 equals the before hash, then rename it over that one target. Immediately verify the restored bytes and mode. Do not touch course/audio/image/font files, IndexedDB, activation files or learner databases.
6. **Handle interruptions conservatively.** If a check fails partway, stop. Restore already-reverted files from the saved pre-rollback copy only if their current bytes/mode still equal the verified baseline just written. If a concurrent edit is present, preserve it and retain all recovery evidence for investigation. Do not overwrite it to force a clean-looking result.
7. **Archive the active successor receipt after restoration.** Once every target matches its before hash/mode, move the entire active `.horizons-workbook-focus` directory to another unique private archive location outside the web root. Preserve its receipt and backups; do not delete them. The active successor path must then be absent so predecessor validators correctly inspect the restored original targets. Leave every earlier private receipt and backup exactly where it was.
8. **Validate the restored chain.** Run the B4/CM/B3/B2 read-only preservation checks from the checked-out repository. Confirm the original manifests and worker suffixes, then verify the demo and licensed application in a browser, including a previously cached client. Compare the six restored hashes to the archived receipt's before hashes one final time. Record the recovery archive location and validation results privately.

The source checkout can retain the generic focus source and historical-source resolver during rollback; the active private receipt determines whether the UI successor is installed. Do not run `deploy-workbook-focus.php --publish` or resume the full pipeline until the intended successor has been reviewed again.
