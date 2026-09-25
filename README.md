# HORIZONS — approved company website

Production copy of the owner-approved preview from 25 September 2026.
Preview source: `92f6c74b6e05d6627fa23af951f5ae763eea47b6`.

## Included

- 32 languages; 11 company/product/legal pages per language.
- Approved Arabic workbook artwork, localized surrounding descriptions and concept covers.
- Ten-second locally hosted company vision video.
- Working browser demo with five letters, 100 words, 100 example sentences and 10 short stories.
- Responsive RTL/LTR layouts and self-hosted typography.
- Production search indexing for company pages. The interactive demo stays noindex.

Only the free sample is included. Paid checkout, online activation, Android and iOS releases are not enabled. Private licence keys, customer data and the paid workbook package are not included.

## cPanel deployment

Use the existing Git Version Control repository on branch `main`:

1. **Manage → Pull or Deploy → Update from Remote**.
2. Confirm the latest approved-site commit appears.
3. **Deploy HEAD Commit**.
4. Open `https://horizons-tr.com/`.

The committed deployment configuration runs:

```sh
/bin/bash scripts/deploy-cpanel.sh /home2/horizonstr/public_html/
```

The script copies only `dist/`, preserves unrelated hosting files and merges a marked Apache block. It does not delete unrelated files. Keep the repository outside `public_html`. No Node.js, Python, database or build command is needed on cPanel; Bash and rsync are used for deployment.

The site version is visible at `https://horizons-tr.com/release.json` after deployment.

## Verification

The approved preview passed 448 Chromium layout cases across 32 languages, mobile/tablet/desktop widths, RTL/LTR navigation and carousel interactions, and browser-demo language selection. Safari and Firefox have not been directly tested. The production preparation additionally checks local links, indexing rules and the cPanel copy script in an isolated document root.

Official cPanel instructions: https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/
