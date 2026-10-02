# Travel Agent Client Kit 2.0.0

The original five-language Library archive was expanded to 32 complete editions. Paid deliverables are kept out of Git and public_html. The single final archive contains 64 editable HTML documents, 64 XLSX workbooks, 192 PDFs, localized launch guides, document indexes, 12 email scripts per edition, and the relevant font/template licences.

Locales: en, ar, tr, fr, es, de, it, pt, nl, ru, uk, pl, cs, ro, hu, el, sv, da, no, fi, bg, sr, hr, he, fa, ur, hi, bn, id, ms, zh, ja. Arabic, Hebrew, Persian and Urdu preserve RTL.

## Validation

All 64 final XLSX files were reopened and recalculated in Artifact Tool. Every example produces trip total 5,600, receipts 1,900, balance 3,700, overdue amount 1,460, commission 240.80 and fee 300. The partial-payment and negative-refund scenarios passed in all 32 examples. No formula errors were found. Mathematical expressions, functions, cell references and numeric inputs are preserved; only language-dependent string constants and sheet names are synchronized. Native styles, table ranges, validation and conditional formatting are retained. Microsoft Excel was not directly tested.

All 32 document packs have 40 pages, examples have eight pages, and the original editing, page-selection, duplicate-page, save-copy and print controls remain present. Every required file is nonempty and ZIP/PDF/XLSX integrity checks pass. PDF text was visually checked in Hebrew, Chinese, Hindi and Persian. Product/order pages passed desktop checks in all 32 locales and mobile checks in Arabic, Hebrew, Persian, Urdu, Japanese and German. The isolated order-form fixture collects no money and sends no external mail.

`tests/travel-manual-delivery.php` checks encrypted orders, idempotency, payment confirmation, matching buyer email, receipt reuse, token hashing, revocation, expiry and the five-download limit. Deployment was tested against a fixture: uninstalled/installed metadata gates, repeat publication, unknown server edits and preservation of unrelated files.

## cPanel publication

1. Pull `main` in the existing `/home2/horizonstr/repositories/horizons-tr-website-live` repository.
2. Upload the archive named in `release-assets/travel-kit-2.0.0/product.json` to `/home2/horizonstr/horizons-product-uploads/`, outside public_html.
3. Deploy HEAD. The configured task verifies the archive hash, exact 32-language folder set and required files, then installs it under `/home2/horizonstr/horizons-travel-delivery/` with private permissions.
4. The guarded publisher installs the order and delivery pages. It publishes verified 32-language metadata only after the private archive matches the release manifest.
5. Inspect cPanel's deployment result and the live pages. On any failure, stop and inspect the recorded error; the publisher restores its own writes and rejects unknown baselines.

The installer can also be run by an authorized operator:

```sh
/usr/local/bin/ea-php82 scripts/install_travel_product.php /home2/horizonstr/public_html/ /home2/horizonstr/horizons-product-uploads/HORIZONS_Travel_Agent_Client_Kit_32_Languages_v2.0.0.zip
```

## Manual fulfilment

Customer requests go to `/manual-order-api/`. The existing private SMTP configuration sends the owner notification to `info@horizons-tr.com` and a localized confirmation to the buyer. The page collects no card/payment and sends no download link.

After independently verifying full payment, the owner logs into `/admin/`, opens **تسليم حزمة وكيل السفر**, and enters the order reference, registered customer email and payment receipt. The page creates a seven-day link with five downloads. The owner copies and emails it manually. A replacement revokes the previous link; one receipt cannot fulfil another order. ZIP access requires the random bearer token posted by the delivery page; there is no public archive path, query token, Gumroad link or automatic delivery email.

## Rebuild

Use the original private `Travel_Agency_Client_Kit_5_Languages.zip` as input. Install Noto core/CJK fonts and point `HZN_TRAVEL_FONT_ROOT` and `HZN_TRAVEL_FONT_LICENSE` to them if they are outside `/usr/share`. Node scripts require the supplied Artifact Tool runtime and Playwright; `HZN_TRAVEL_CHROMIUM` selects an installed Chromium executable.

Run `normalize_travel_translations.py`, `build_travel_kit.py ORIGINAL OUTPUT`, `travel_workbooks.mjs build TASKS AUTHORED`, `preserve_travel_workbooks.py TASKS AUTHORED`, `update_travel_guides.py OUTPUT`, and `travel_pdfs.mjs OUTPUT CHECKS`. Rebuild the launch guides with `travel_pdfs.mjs OUTPUT CHECKS guides`; reopen all finished XLSX files with `verify_travel_workbooks.mjs OUTPUT REPORT`. Then run `build_travel_storefront.py OUTPUT` and `check_travel_release.py OUTPUT CHECKS ORIGINAL`. Keep calculation reports in CHECKS for final verification. The release manifest contains the final archive SHA-256 and exact byte length.
