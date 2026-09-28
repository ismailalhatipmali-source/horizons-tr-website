# HORIZONS — website and Arabic Workbook 1.4.0

This repository prepares the existing HORIZONS website and Arabic Level 1 workbook for the owner's cPanel deployment. The approved company design, 32 site languages, localized pages, video, and RTL/LTR layouts remain in place. The original company preview is recorded by `preview_source_commit` in `dist/release.json`.

## Workbook entry points

| Purpose | Published path after deployment |
| --- | --- |
| Open the full workbook in a browser | `/learn/` |
| Try the free five-letter demo | `/try/` |
| Optional Windows installer | `/downloads/HORIZONS-Arabic-Setup-1.4.0.exe` |
| Existing Windows update feed | `/updates/arabic-level-1.json` |
| Check the deployed website release | `/release.json` |

The full workbook contains 28 letter lessons, 560 words, 560 example sentences, and 56 short stories. It uses the existing activation service and its signed entitlements. This release does not create a second activation backend. Public checkout remains disabled.

The demo contains only **ب، ظ، ض، ي، ذ**, in that order: `baa`, `dhaa_emphatic`, `daad`, `yaa`, `dhaal`. It has five lessons, 100 words, 100 example sentences, and 10 stories; it does not require activation.

Browser use is the primary option. Installing a web-app icon or the Windows application is optional. Adding a web-app icon does not download every lesson: users explicitly save the content they need for offline use. Browser storage can be cleared or evicted. Full-edition offline access still requires a valid entitlement; downloading content does not extend a time-limited licence.

The paid browser content is included only as encrypted release assets. Decryption occurs for an activated user; the owner content key and signing private key are not published. The public five-letter demo contains its own reduced content. Learner progress stays on the user's device, with export/import for backups.

## Deploy from the existing cPanel Git repository

Keep the repository outside `public_html` and use branch `main`. The owner performs these two actions in **Git Version Control → Manage → Pull or Deploy**:

1. Select **Update from Remote** and confirm that the new 1.4.0 commit appears.
2. Select **Deploy HEAD Commit** and wait for successful completion.

The initial 1.4.0 update includes approximately 1.5 GB of release assets, so the first pull can take time. There is no separate manual upload of the split release files. Git pulls their chunks with the repository, and the deployment script reconstructs the four approved artifacts automatically.

The checked-in `.cpanel.yml` runs:

```sh
/bin/bash scripts/deploy-cpanel.sh /home2/horizonstr/public_html/
```

The script stages the `learn`, `demo`, `setup`, and `update` artifacts from `release-assets/1.4.0/manifest.tsv`. It verifies the expected part count, reconstructed byte size, and SHA-256 before changing public files. ZIP contents are checked against the permitted destinations. Website files from `dist/` and the verified release artifacts are then installed into the document root. The deployment keeps hosting-specific Apache rules and unrelated files, and keeps deployment backups outside the public document root.

The host needs **Bash, `unzip`, `sha256sum`, and standard Unix file tools**. It does not need Node.js, Python, a package install, or a workbook build. Deployment uses standard copy/move tools; `rsync` is not required. Leave adequate disk space for the checkout, reconstructed artifacts, staging area, deployed files, and backups.

Deployment does not replace the existing activation service, SMTP settings, customer database, owner vault, or private keys. None of those private materials belong in this public repository. Keep `release-assets/` outside the public document root; only its verified deployment outputs are published.

If deployment fails, inspect the newest `.cpanel/logs/vc_*_git_deploy.log` and `.cpanel/logs/user_task_runner.log` in the hosting account. Do not manually deploy partial chunks. A successful run ends with `HORIZONS 1.4.0 deployed to ...` and exit code 0. After deployment, open the site and check `/release.json`, `/learn/`, `/try/`, and the Windows installer link.

Pushing this repository to GitHub is preparation for the owner's pull deployment. The cPanel pull/deploy actions are not performed as part of preparing this commit. There are no checked-in GitHub Actions deployment workflows.

## Deployment verification

Eleven failure/preservation tests and a full isolated deployment passed. The full run verified all 179 chunks, 3,379 extracted files, and the installer hash; it preserved activation/hosting sentinels, replaced the demo exactly, and cleaned staging. See `tests/deployment-verification-1.4.0.json`.

## Verification limits

The release includes content, packaging, entitlement, and local browser verification. This does not establish a successful deployment on this particular cPanel host. The Windows installer has **not been executed on a real Windows system**, and the final **production HTTPS PWA installation/offline flow has not been tested on the live domain**. The EXE is **not Authenticode-signed**. These limits must not be described as completed tests.

For the chunk format and public/private boundary, see [release-assets/README.md](release-assets/README.md). Official cPanel deployment instructions: https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/.
