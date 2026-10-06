# Reversible Apache hardening

`src/security/public.htaccess` is the reviewed Apache 2.4 policy. The identical
block is included in `dist/.htaccess` so a base deployment retains it. Existing
cPanel handlers and PHP ini files are preserved. The scoped production chain in
`.cpanel.yml` does not apply this policy automatically.

The policy denies direct HTTP access to known PHP configuration/bootstrap files,
environment files, SQLite/SQL files, editor/backup files, private keys and VCS
paths. PHP-like extensions, including mixed case, compound suffixes and PATH_INFO,
are denied in `assets`, `downloads`, `updates`, `try` and `learn/content`.
Application entry points in activation, learning-api, admin, checkout-api,
manual-order-api and travel-download remain usable. PHP includes are unaffected.
Apache authorization is used without changing PHP-FPM handlers or disabling PHP
globally. No public upload endpoint was found in the reviewed API sources; private
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

## Restore

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
are outside PATH. A skipped runtime suite is not a pass. Production verification
was blocked on 2026-10-06 by unavailable browser credential state; no hosting
configuration change, ini change, additional quarantine move or live release
deployment is established by these repository changes.
