# Public release artifacts

This directory holds the four already-built public artifacts for Arabic Workbook **1.4.0**, split into binary chunks no larger than **8 MiB** each. It is outside `dist/` and must not be copied wholesale into `public_html`.

The chunks avoid putting a large installer or ZIP into a single ordinary Git blob. They are deployed through the existing cPanel Git pull/deploy flow; the owner does not need to upload the individual files manually. No Git LFS checkout or client-side assembly is required.

## Manifest and layout

`1.4.0/manifest.tsv` is a UTF-8, tab-separated manifest. Its first line contains `HORIZONS_RELEASE_V1` and `1.4.0`, separated by a tab.

The four following rows identify `learn`, `demo`, `setup`, and `update`. Every row has five tab-separated fields: `kind`, `filename`, `totalBytes`, `lowercaseSHA256`, and `partsCount`.

Each kind has its own folder with sequential, nonempty `part-0000`, `part-0001`, … files. The ordered concatenation must exactly match the manifest's byte size and SHA-256. These are binary parts: do not edit them, convert their line endings, omit a part, or extract a part individually.

| Kind | Reconstructed artifact | Permitted deployment output |
| --- | --- | --- |
| `learn` | Full web release ZIP | `learn/` |
| `demo` | Reduced public demo ZIP | `try/` |
| `setup` | Windows installer EXE | `downloads/HORIZONS-Arabic-Setup-1.4.0.exe` |
| `update` | Windows update distribution ZIP | The versioned update package in `downloads/` and `updates/arabic-level-1.json` |

The deployment script reconstructs and verifies **all four artifacts in private staging before copying public files**. Archive paths must pass its destination checks. It requires Bash, `unzip`, `sha256sum`, and standard Unix tools; it does not build the application or require Node.js or Python. Staging and backups remain outside the public document root.

## Publication boundary

Only approved public distribution artifacts belong here. The full curriculum in the browser release and Windows packages remains encrypted; the freely available demo is physically limited to the five selected letters. Public verification keys and signed release metadata may be distributed.

Never add the private owner source package, owner vault, content-encryption key, signing private key, SMTP credentials, activation-service configuration, customer database, licence registry, or personal learner records. The existing activation service, mail configuration, and database are not replaced by this deployment.

## Replacing a release

Prepare the complete artifact set first. Replace its chunks and manifest together, and confirm the reconstructed hashes before committing. Do not change binary parts independently of the manifest. A new application version should use a new version directory and the corresponding deployment setting; do not silently substitute different bytes for an already-published artifact.

The Windows EXE is not Authenticode-signed. Execution on real Windows and the production HTTPS PWA installation/offline flow remain untested; artifact integrity checks do not substitute for those tests.
