# Workbook interface 1.4.5

Owner request: complete the workbook interface in the same 32 languages as the
website, before a separate phase for pronunciation fixes and new curriculum.

## Included

- 77 shared UI messages in each of 32 languages. Existing lesson instructions
  already had 32-language coverage; this release completes account and PWA UI.
- Email-code activation, password login/recovery, family/institution learner
  controls, errors, installation guidance and offline save/check/delete controls.
- The same permanent-email warning and acknowledgement as the storefront.
- Arabic, Hebrew, Persian and Urdu directions, isolated email addresses and
  interpolated values, locale-aware file sizes, and wrapping for long labels.
- Regional locale normalization, Norwegian browser aliases, and language
  continuity from the website into the workbook. Changing language also updates
  displayed status/error messages and accessible progress labels.

The Arabic curriculum, approved cover, voices, activation protocol, passwords,
progress storage and synchronization service are not modified. Optional meanings
of words/stories still use the existing Arabic/English/Turkish/French/Spanish
content, as explained by the existing translated help. This is an interface
release, not new lesson translations or a pronunciation review. Windows remains
the historical optional release; the browser/PWA is the current product.

## Build and deployment

`python3 scripts/build_interface_update.py` checks exact key/placeholder coverage,
creates the demo's smaller locale bundle, updates the two integrity manifests and
writes `release-assets/1.4.5/interface-manifest.json`. The baseline is the
owner-approved cover commit `f720db2fe4fc49a5d6d246e563563fbafa5a4ce8`.

All 2,765 encrypted paid asset records and 497 demo curriculum/media records are
unchanged. The public overlay has 19 files, approximately 2 MB; no large media
archives are rebuilt. `.cpanel.yml` runs the restricted CLI publisher. It rejects
unknown destinations, changed public baselines, symlinks, damaged sources and
concurrent deployment, then backs up changed files outside public_html. On a
publication error it restores already changed files. Re-running is idempotent.

Close all workbook windows and reopen once when the update notice appears.
Existing downloaded lessons and progress are retained; the demo worker validates
old cached media against the new manifest before reusing it.

## Verification

- All 32 languages have identical key coverage and matching interpolation tokens.
- Activation code → password flow exercised in all 32 languages with mocked
  services; passwords are cleared and never persisted in browser storage.
- DOM integration tests switch through all 32 shell and demo languages, check
  RTL/LTR, translated errors, labels, deep links and accessibility text.
- Existing password and individual/family/institution roster behavior passes.
- Publisher tests cover preflight, backups, idempotence, preserved lesson/data
  sentinels, changed baselines, corrupt files, locks and forbidden paths.

These checks do not certify every physical device or replace native-speaker
editorial review. The release makes no changes to sales enablement: checkout
remains a preview, bank-card integration is pending, and an actual paid
activation/email/synchronization journey is still a separate verification task.
