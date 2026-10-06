# Reversible Apache hardening

`src/security/public.htaccess` is the reviewed Apache 2.4 policy. The identical
block is included in `dist/.htaccess` so a base deployment retains it. Existing
cPanel handlers and PHP ini files are preserved. The temporary `.cpanel.yml` task runs only the guarded Apache transaction.
The original product publication chain is retained in Git at commit
`4a9e26d0c3edec60787e6d42be1f7d2b1157763f` and must be restored after this
host verification completes.

The policy denies direct HTTP access to known PHP configuration/bootstrap files,
environment files, SQLite/SQL files, editor/backup files, private keys and VCS
paths. PHP-like extensions, including mixed case, compound suffixes and PATH_INFO,
are denied in `assets`, `downloads`, `updates`, `try` and `learn/content`.
Application entry points in activation, learning-api, admin, checkout-api,
manual-order-api and travel-download remain usable. PHP includes are unaffected.
Apache authorization is used without changing PHP-FPM handlers or disabling PHP
globally. Independent `RewriteRule [F,L]` guards run before existing host rules;
expression authorization is retained for Apache child-directory inheritance.
Both the scoped publisher and the base publisher place the security block first
while preserving the remaining host directives. No public upload endpoint was found in the reviewed API sources; private
product staging is outside the document root. Unreviewed live upload directories
still require a filesystem inventory and their own verified protection.

## Host preflight and publication

Before applying, inspect the actual document root, Apache 2.4 support and
AllowOverride authorization/expression support. Read the current `.htaccess`,
`.user.ini`, `php.ini`, PHP SAPI and effective `allow_url_include` setting through
private CLI/host configuration. `allow_url_include` is an INI_SYSTEM setting;
adding it to `.user.ini` is not evidence that it changed. Keep `allow_url_fopen`
unchanged. Do not create a public phpinfo endpoint or remove ini files merely
because the deprecated warning appeared in historical logs.

Run with the host PHP CLI, for example `/opt/cpanel/ea-php82/root/usr/bin/php`:

```sh
PHPCLI=/opt/cpanel/ea-php82/root/usr/bin/php
"$PHPCLI" scripts/deploy-hardening.php status /home2/horizonstr/public_html
"$PHPCLI" scripts/deploy-hardening.php apply /home2/horizonstr/public_html
```

The apply command modifies only the root `.htaccess`. It rejects symbolic links,
malformed markers and repository/document-root overlap. Original bytes, SHA-256,
mode and target are recorded under a new private sibling
`.horizons-hardening-public_html/batch-*`. Private directories are 0700, backups
and manifests 0600. Publication uses an atomic rename and retains all bytes needed
for reversal. An identical policy is a no-op. Inspect HTTP results immediately;
the CLI receipt explicitly does not certify host HTTP behavior.

Use harmless, newly created probes only when host verification needs actual files.
Check 403 and absence of probe content, then move those probes privately. Never
request known suspect backdoor URLs, actual secrets, databases or real backup
contents. Verify legitimate downloads and every supported locale, both directions,
the workbook, trial pause and existing PHP API errors. Do not send mail, pay, create
customers or mutate orders during these checks.

## One-command guarded execution

`scripts/execute-hardening.php /home2/horizonstr/public_html` wraps the scoped
publisher in private configuration snapshots, baseline and post-publication HTTP
checks, and inert synthetic probes. It checks nine existing public routes and
creates 14 inert files in each of `assets`, `downloads`, `updates`, `try` and
`learn/content`. It verifies 95 requests including controls, alternate/compound
extensions, encoded filenames and PATH_INFO, then moves all 70 probe files to
private retention. Failed probe status, body hash and marker exposure are recorded
before rollback. A normal post-publication HTTP
failure triggers exact rollback using the publisher's retained batch. Subsequent
operator edits still cause restore to fail closed rather than overwrite them.
The corrected runner also checks the nine public routes after rollback and
reports a separate HTTP verification error if that check fails.

The transaction calls the publisher in the same PHP process. HTTP checks use
PHP's HTTPS stream with certificate and hostname verification, a 12-second read
timeout, no redirect following and a 1 MiB response limit. It requires the
existing `allow_url_fopen` capability but does not change that setting or enable
any disabled process function. The host attempt on 2026-10-06 stopped at the
disabled `proc_open()` call before publication; the corrected runner needs no
`proc_open`, `exec`, `shell_exec`, `system`, `passthru` or `popen`.

The receipt distinguishes Apache policy verification from the still-unverified
web/FPM ini settings. It does not alter ini files, customer state, cron, passwords,
existing quarantines or product files. Configuration snapshots and receipts are
0700/0600 outside public_html. The `--fixture` option is restricted to loopback
HTTP and refuses the real production document root.

Run this from a clean live-main checkout after a fast-forward update. Inspect the
terminal's resulting status and private result path. `applied_http_verified` means
this scoped Apache transaction passed; it does not certify complete host cleanup
or effective FPM settings. Browser/hosting access is still required to run it.

## Restore a retained batch

Pass the exact batch path printed by apply:

```sh
"$PHPCLI" scripts/deploy-hardening.php restore /home2/horizonstr/public_html /home2/horizonstr/.horizons-hardening-public_html/batch-TIMESTAMP-ID
```

Restore verifies the original backup hash and refuses to overwrite subsequent
operator edits. Original bytes and mode are restored; displaced hardened bytes
remain in a private `restore-*` directory. If `.htaccess` was originally absent,
the created file is moved privately rather than deleted. Existing malicious-file
quarantines are never restored by this command. Interrupted operations retain a
private journal; inspect the current hashes before resolving a stale lock.

## Local validation and limitations

`tests/test_hardening.py` starts Apache on loopback against synthetic inert files
and tests reversible publication in temporary directories. It verifies HTTP
authorization and allowed route bytes, not production PHP handler behavior.
`tests/test_deploy_cpanel.py` tests preservation, scoped-block migration, malformed
marker rejection and deployment failures without touching a host.

Set `HZN_TEST_PHP`, `HZN_TEST_APACHE`, and `HZN_TEST_APACHE_MODULES` when the runtimes
are outside PATH. A skipped runtime suite is not a pass. The guarded-runner suite
passes seven actual Apache cases with all six process functions disabled,
including publication, idempotence, exact rollback after an injected HTTP
failure, redirect rejection, oversized-response rejection, enforcement without
expression sections despite an existing host pass-through, and retained failed
probe diagnostics. The publisher's seven Apache/restore tests also pass.

The private host receipt from 2026-10-06T16:48:48Z proves only configuration
snapshots and the pre-publication `proc_open()` failure. The CLI was PHP 8.2.34
with `allow_url_fopen=1` and `allow_url_include=1`; effective web/FPM values remain
unverified. No Apache publication, ini change or additional quarantine move is
established by that failed attempt. Review the corrected host receipt before
claiming production verification.

The next host receipt, 2026-10-06T18:19:15Z, proves publication and exact successful
rollback after the first inert PHP-denial check failed. All nine public routes
passed before and after publication. The previous runner did not retain the
failed probe's status, so that receipt does not establish whether it was a
200, 404 or another response, nor does it identify the host webserver. The added
rewrite enforcement addresses that observed denial failure without assuming a
specific frontend; the next host run must verify all five namespaces.

## Temporary cPanel deployment task

When Terminal is unavailable, the existing live repository's **Update from
Remote** button performs the fast-forward update, and **Deploy HEAD Commit**
runs `scripts/deploy-cpanel-hardening.sh`. cPanel refuses a dirty working tree;
the wrapper independently verifies the exact private checkout, clean main branch,
reviewed ancestor and separate document root. It shares the existing deployment
lock and runs only `execute-hardening.php`, without running the product publishers
or sending test mail. The deployment log records the exact host HEAD and private
result path.

This task temporarily replaces the normal `.cpanel.yml` task. After reviewing a
successful private receipt, restore the original `.cpanel.yml` bytes from commit
`4a9e26d0c3edec60787e6d42be1f7d2b1157763f` in a new fast-forward commit.
Update the host checkout again to restore the task; that update does not require
running the unrelated product deployment chain. Do not reset or force a host
checkout with local changes.
