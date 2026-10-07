# Host-check delivery, not live UI publication

## Current cPanel mode

The active `.cpanel.yml` now runs **only** `scripts/check-native-ui-host.sh`.
This wrapper verifies the existing private live checkout, main branch, document
root, PHP 8.2 path, absence of the production lock and the CLI entry point. It
then invokes `scripts/deploy-native-ui.php` with the fixed **--check** argument.
It cannot select --publish, --recover or --rollback through an environment variable.
The check performs the existing release/receipt verification and the six-file
transformation in memory. No website, media, activation, progress, backup,
receipt, cache or worker file is written. cPanel may update its own normal Git
checkout, deployment log and last-deployment metadata.

The older production task is preserved byte-for-byte in
`scripts/cpanel-production-before-native-ui.yml` (Git blob
`3a8bfe2e0842a3598e6b760b269b94223584cfe9`). The previous UI publication candidate
is retained in `scripts/cpanel-native-ui-publish-candidate.yml` (Git blob
`1ba6d713c3e9466e7c5b1642a602af8a8a9285ea`). Neither archive is executed by the
current cPanel task. Other publication tasks are temporarily suspended by this
explicit check-only configuration, not deleted. Do not assume a successful
cPanel job publishes the UI in this revision.

## Revised merge scope

The UI source and its publisher are delivered behind this read-only host gate
so the owner can run the missing host preflight using the two existing cPanel
buttons without shell access, repeated sign-in, file uploads or downloads.
Merging this source is **not** approval to run the archived publication task,
nor a claim that licensed-browser behavior has passed. Earlier notes requiring
the full publisher PR to remain draft referred to automatic publication; this
revision removes automatic publication from the active entry point.

After the host check result, a separate reviewed change must deliberately
restore/enable publication and preserve the rollback path. Private-reader,
recorded-audio, progress and offline-browser checks remain open.

## Owner procedure

Keep the existing live checkout on main. Click Update from Remote and verify
that HEAD is the exact host-check commit delivered in the conversation. Only
then click Deploy HEAD Commit: in this revision that button executes the
read-only check. Report the success/failure message only. Do not send a vault,
password, licence key or private plaintext player. Stop if Update from Remote
fails or HEAD does not match; never force-reset the server checkout.

## Verification for this revision

The pipeline tests retain the old archived-chain contract and add read-only
gate checks for correct arguments, propagated failure, wrong branch/root,
active lock, symlinked entry, missing document root and unavailable PHP.
Filesystem snapshots verify that these synthetic gate runs do not change files.
The native publication and predecessor bridge tests remain in place. These are
isolated checks, not proof that the real host preflight ran.
