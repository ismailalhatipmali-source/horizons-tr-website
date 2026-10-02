# HORIZONS — Arabic Workbook web/demo 1.4.5 / Windows 1.4.0

This repository prepares the existing HORIZONS website and Arabic Level 1 workbook for the owner's cPanel deployment. The approved company design, 32 site languages, localized pages, video, and RTL/LTR layouts remain in place. The original company preview is recorded by `preview_source_commit` in `dist/release.json`.

## Interface update 1.4.5 — 2026-10-02

The web workbook and public demo now use the same 32 interface languages as the
website, including activation, passwords, learner management, installation and
offline saving. The existing Arabic lessons, recordings, approved cover and
optional five-language word/story meanings are unchanged.

Build with `python3 scripts/build_interface_update.py`. On the existing installed
host, `.cpanel.yml` publishes the 19 public interface files using
`scripts/deploy-interface.php`. It checks every source and installed baseline,
backs up changed files privately, and preserves activation services, databases,
encrypted lessons, saved progress and previously downloaded media. This overlay
requires the existing membership release; it is not a fresh installation package.
See [the interface release record](docs/interface-release-1.4.5.md).

## Membership deployment 1.4.4 — 2026-10-02

The private membership service, full workbook 1.4.4 and the account storefront
are installed on `https://horizons-tr.com/`. The cPanel UI confirmed successful
publication of `7b4dbd549a4145484cd09ce8a6b2dcbecaa55ba0` at 08:59:39
Istanbul time on 2026-10-02. **Public checkout is still a non-collecting preview;
neither bank-transfer sales nor card collection is enabled.**

The live browser checks confirmed the start dialog, free demo, seven account
prices, persistent cart, 250 country/territory suggestions, country-dependent
city suggestions, and the workbook's email-code activation entry. The private
worker runs every minute. SMTP TLS and authentication succeeded, but no email was
sent during verification; receipt of an activation email and a real paid
activation/password/synchronization journey have not been verified on this host.

For the previous storefront deployment, `.cpanel.yml` used the small verified
`scripts/deploy-storefront.php` publisher. It preserves workbook lessons,
configuration, runtime databases and unrelated public files, and keeps private
rollback backups. It deliberately requires workbook 1.4.4 to be installed first.
This avoided rebuilding the large immutable legacy release archives on every
storefront edit. PHP deployment diagnostics are written outside the Git checkout.

See [the deployment record](docs/deployment-2026-10-02.md) for exact verification,
remaining sales work and operational commands. The older release/deployment
instructions below are historical context, not the current storefront command.

## Membership implementation

This branch extends the existing issuer for individual/family/institution accounts,
code → password activation, any-device login, authenticated rosters and manual
bank-credit confirmation followed by automatic fulfilment. Public collection is
still disabled. See src/activation/README.md and src/commerce/README.md for current
behavior and the required hosting checks. Historical release notes below describe
older versions; web 1.4.4 must follow the private service installation.

Build the separate cPanel installation ZIP with
`python3 scripts/build_membership_update.py`. It is produced in the sibling
`deliverables` directory. Extract beside public_html and run the CLI preflight.
Never publish private app/commerce source under public_html. Config, vault and
progress are preserved, and changed files/database are backed up privately.

## Workbook entry points

| Purpose | Published path after deployment |
| --- | --- |
| Open the full workbook in a browser | `/learn/` |
| Try the free five-letter demo | `/try/` |
| Optional Windows installer | `/downloads/HORIZONS-Arabic-Setup-1.4.0.exe` |
| Existing Windows update feed | `/updates/arabic-level-1.json` |
| Check the deployed website release | `/release.json` |
| Authenticated learning-progress API | `/learning-api/` |

The full workbook contains 28 letter lessons, 560 word cards with example sentences, and 56 short stories. It uses the existing activation service and its signed entitlements. This release does not create a second activation backend. Public checkout remains disabled.

The demo contains only **ب، ظ، ض، ي، ذ**, in that order: `baa`, `dhaa_emphatic`, `daad`, `yaa`, `dhaal`. It has five lessons, 100 words, 100 example sentences, and 10 stories; it does not require activation.

The public demo update **1.4.3** fixes audio being immediately cancelled after changing a lesson. The old course-button selector also matched the body after the layout added `data-course`, so every click bubbled into another navigation and stopped playback. The selector is now scoped to `#course-nav`. The independently verified four-file demo overlay is applied to the original 1.4.0 archive during cPanel deployment; its lessons, media, bundled course data and progress storage keys remain unchanged. Compatible media already saved under the previous demo cache remains usable offline after the update. The full browser edition stays at 1.4.2 and Windows stays at 1.4.0. Preparing this commit does not publish it to the live site.

Build the demo overlay with `python3 scripts/build_demo_overlay.py`. It verifies all original demo ZIP parts and allows only the reviewed navigation fix and displayed-version change in the player. Run deployment preservation/failure checks with `python3 tests/test_deploy_cpanel.py`. Run the real Chromium regression in `tests/test_demo_navigation.mjs` against a staged, isolated loopback fixture using `HZN_DEMO_BASE_URL`, `HZN_DEMO_DOCROOT` and `E2E_CHROMIUM`; it verifies all five lessons without refresh, actual audio completion, activity controls, progress after reopening, and reuse of previously saved audio offline. Physical-phone verification follows the owner's pull/deploy.

Browser use is the primary option. Installing a web-app icon or the Windows application is optional. Adding a web-app icon does not download every lesson: users explicitly save the content they need for offline use. Browser storage can be cleared or evicted. Full-edition offline access still requires a valid entitlement; downloading content does not extend a time-limited licence.

The paid browser content is included only as encrypted release assets. Decryption occurs for an activated user; the owner content key and signing private key are not published. The public five-letter demo contains its own reduced content.

The 1.4.1 web update adds online learning-progress synchronization through the existing adult account entitlement, with separate learner profiles. Progress is retained locally during disconnection and synchronized when a connection is available. The PHP progress service is separate from activation: it reads the existing activation configuration and licence state, and keeps its own learning data outside the public document root. Media still loads on demand; saving lessons for offline use remains optional. The Windows installer and signed Windows update feed remain at 1.4.0.

Web 1.4.2 adds password sign-in for an adult account after an email-code activation. The email code also resets the password. A password issues the same signed per-device licence under the existing one-/three-device limits; it does not create another entitlement, extend a trial, or replace the independent learner-progress synchronization consent. The private activation-service update is deliberately **outside this public repository** and must be installed and checked before the 1.4.2 web overlay is deployed. Until then, keep the live 1.4.1 shell.

Audio buttons now stay within the active lesson instead of triggering a second navigation that interrupted playback. The player shows loading, playback and retry states and cancels abandoned requests. A bounded automatic cache reuses recently requested audio; a slow audio request does not block lesson navigation. Hidden illustration panels load their images only when opened. The initial curriculum data file is compressed before encryption, reducing its transfer from 4,453,793 to 869,790 bytes while preserving its decrypted content.

## Deploy from the existing cPanel Git repository

Keep the repository outside `public_html` and use branch `main`. Only after the private activation update has been installed and checked, the owner performs these two actions in **Git Version Control → Manage → Pull or Deploy**:

1. Select **Update from Remote** and confirm that the new 1.4.2 web update commit appears.
2. Select **Deploy HEAD Commit** and wait for successful completion.

The initial 1.4.0 update includes approximately 1.5 GB of release assets, so the first pull can take time. There is no separate manual upload of the split release files. Git pulls their chunks with the repository, and the deployment script reconstructs the four approved artifacts automatically.

For a checkout that already has 1.4.0, Git only needs the changed web/API files and small encrypted web patch. The 179 base release chunks are unchanged. Deployment still reconstructs and verifies the base packages locally, so allow the same staging and backup disk space as the original deployment.

The checked-in `.cpanel.yml` runs:

```sh
/bin/bash scripts/deploy-cpanel.sh /home2/horizonstr/public_html/
```

The script stages the `learn`, `demo`, `setup`, and `update` artifacts from `release-assets/1.4.0/manifest.tsv`. It verifies the expected part count, reconstructed byte size, and SHA-256 before changing public files. ZIP contents are checked against the permitted destinations. It then verifies every entry in `release-assets/1.4.4/manifest.tsv` and applies the web overlay in private staging. This shell-only update reuses the unchanged 1.4.0/1.4.1 encrypted lessons. Only approved source-to-destination mappings under `/learn/` and `/learning-api/` are allowed; runtime data and activation configuration cannot be deployed by this manifest. Website files from `dist/` and the verified release artifacts are then installed into the document root. The deployment keeps hosting-specific Apache rules and unrelated files, and keeps deployment backups outside the public document root. Ordinary publication errors restore the changed paths from those backups.

The host needs **Bash, `unzip`, `sha256sum`, and standard Unix file tools**. It does not need Node.js, Python, a package install, or a workbook build. Deployment uses standard copy/move tools; `rsync` is not required. Leave adequate disk space for the checkout, reconstructed artifacts, staging area, deployed files, and backups.

Online progress also requires **PHP 8.2 or later with PDO_SQLite, sodium, and OpenSSL** in the website's PHP runtime, plus write access to the account-owned parent of the document root. The progress API creates `horizons-learning/` beside `public_html` with private permissions (directory `0700`, database/key files `0600`). Keep this folder outside Git and include it in private hosting backups. It is not replaced or rolled back by code deployment. The API discovers the existing activation configuration through `HORIZONS_LICENSE_CONFIG`, `activation/config-path.php`, or `activation/config.php`; it does not change that configuration. CLI PHP and the website PHP runtime can differ.

Deployment does not replace the existing activation service, SMTP settings, customer database, owner vault, or private keys. None of those private materials belong in this public repository. Install the separate private authentication bundle first. Keep `release-assets/` outside the public document root; only its verified deployment outputs are published.

If deployment fails, inspect the newest `.cpanel/logs/vc_*_git_deploy.log` and `.cpanel/logs/user_task_runner.log` in the hosting account. Do not manually deploy partial chunks. A successful run ends with `HORIZONS web 1.4.2 (Windows 1.4.0) deployed to ...` and exit code 0. After deployment, open the site and check `/release.json`, `/learn/`, `/try/`, and the Windows installer link. Verify audio without choosing offline download, then use the same learner profile on two activated phones to check progress synchronization.

After deployment, close all open workbook tabs and reopen `/learn/` so the new service worker can take control. **Do not clear browser storage**: it contains existing local progress and activation. In the workbook's learner settings, enable online progress for the adult account and explicitly select any existing local learner profiles to include. On the second activated device, use the same account, enable synchronization, and select the downloaded learner profile. Pausing synchronization keeps existing cloud records; deleting a synchronized profile removes its saved progress when the deletion reaches the server. Conflicting edits are preserved for the user to resolve.

Pushing this repository to GitHub is preparation for the owner's pull deployment. The cPanel pull/deploy actions are not performed as part of preparing this commit. There are no checked-in GitHub Actions deployment workflows.

## Deployment verification

The original 1.4.0 verification checked all 179 chunks, 3,379 extracted files, and the installer hash; see `tests/deployment-verification-1.4.0.json`. The updated deployment suite includes 17 isolated failure/preservation checks, covering a fresh document root, upgrades, corrupt or missing web overlays, invalid/private destinations, symlink sources, and rollback of both the workbook and progress API. It also verifies that activation/hosting data and private learning-progress state remain intact.

For the shell-only update, `python3 scripts/build_web_shell_update.py` verifies the committed predecessor and packages its encrypted assets without reading any private key. `node --test tests/test_password_ui.mjs` checks the new forms, input validation and reused encrypted asset hashes. The private PHP password-flow test travels only in the separate bundle; it has not yet run against the target PHP runtime and must pass before this release is described as production-verified.

Run developer checks with `python3 tests/test_deploy_cpanel.py`. When the complete base chunks and original approved ZIPs are available, `tests/verify_deploy_release.py` verifies the unchanged base files, every overlaid file, and the installer in a new isolated document root.

The 1.4.1 verification report is [tests/online-verification-1.4.1.json](tests/online-verification-1.4.1.json). Eight complete Chromium checks use the actual encrypted workbook, browser audio, separate browser contexts and the production PHP progress code against synthetic activation records. They cover audio playback and cache reuse, navigation during delayed media, consent, a 206,259-byte progress round trip, offline reconnection, account isolation and legacy schema 2 activation. Supporting suites passed 22 media/worker/decompression tests, 16 client tests with real IndexedDB, 13 PHP functional groups, 26 inner-application DOM checks and 17 deployment checks. See [tests/learning-api/E2E.md](tests/learning-api/E2E.md) for the isolated browser/PHP fixture; it is never deployed.

## Verification limits

The release includes content, packaging, entitlement, and local verification. This does not establish a successful deployment on this particular cPanel host. **Password activation in PHP has not yet been exercised in an available CLI/runtime; do not deploy the web shell until the private service is tested.** Real Android audio and two-phone online-progress synchronization require verification after the owner deploys. The Windows installer has **not been executed on a real Windows system**, and the final **production HTTPS PWA installation/offline flow has not been tested on the live domain**. The EXE is **not Authenticode-signed**. These limits must not be described as completed tests.

For the chunk format and public/private boundary, see [release-assets/README.md](release-assets/README.md). Official cPanel deployment instructions: https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/.
