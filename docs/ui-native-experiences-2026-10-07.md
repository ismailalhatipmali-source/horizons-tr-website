# HORIZONS — Native experiences, implementation phase 2

Date: 2026-10-07. Component version: 0.3.0.
Branch: `ui/approved-comfort-controls-20261007`; draft PR #12.

## Delivery state

The native presentation adapter and private staging builder are implemented. This is **not a production release and not a completed full-workbook migration**. Nothing was merged into main or deployed to the hosting account in this phase. The owner has already approved the visual direction; a new design approval is not required to continue integration.

Seven new executable/source/test files were committed through `3a084db1ad731517c91e8d3a89d3eadd1c1145a4`. Their Git blob hashes were re-read from GitHub and matched the locally tested bytes.

## What was added

The four experiences reuse the native reader's elements and handlers. Focus uses a compact list and desktop stage rail; Adventure uses the bounded approved landscape with native section buttons; Discovery uses activity cards; Sprout emphasizes the current activity and moves the same stage-navigation element into a compact disclosure. They are not four duplicated curricula.

The adapter supplies a four-choice modal, comfortable light and dark appearances, current-language labels, learner-scoped appearance preferences, and a session-only fallback when storage is unavailable. It decorates existing navigation without changing disabled controls or entitlement decisions. Seven upcoming sections are grouped in a passive disclosure; their content has not been authored by this change.

The B3/B4 shadow-reader stylesheet is applied inside recognized open reader roots, including late-mounted roots. It preserves educational glyph paths and their diacritic palette, and excludes correct/incorrect assessment colors from generic button recoloring. Original educational images and recordings are neither replaced nor fetched by this layer. Decorative landscape and companion SVGs were extracted from the approved Review 02, not from lesson images.

New UI copy includes 27 keys in each of the 32 project languages. This is new-interface key coverage, **not** independent linguistic certification or a claim that all existing course translations have been reviewed.

## Native integration contract inspected

The connector was used to read these repository sources at the existing branch baseline `b5d1fc7b698df745a9881eb12d7de54b22d6abc5`:

- `src/workbook-focus/focus-shell.js`, including `hznFocusShell.currentLearnerKey()` and native home/activity/stage controls.
- `src/demo-pwa/index.html`, including original navigation and dialog structure.
- `src/workbook-focus/blending3-component.js` and `blending4-component.css`, including shadow-reader selectors and educational color variables.

The compiled current full-workbook player and its licensed content were **not** loaded into this test environment. Selector compatibility on the inspected sources is not proof of all runtime behavior. The production CSS cascade, hidden-state rules, every section layout and component lifecycle still require verification with the compiled reader.

## Preservation boundaries

The only preference keys written by the new controller have the prefix `horizons.experiences.v1:` and are scoped by the native learner key. Progress, handwriting and favorite data remain owned by the original reader. The adapter does not decode or copy licensed content, request media, change the learning API, create learner accounts, or alter activation/payment settings.

The private staging builder requires an exact expected SHA-256 and one existing focus-shell marker pair. It appends the new layer while preserving the original byte prefix. It refuses repeat installation, a phase-1 comfort-staged input, output overwrite, symlink output and common public web roots. Use the original verified player as input, not the previous experimental output.

No encrypted assets, asset manifests, service workers, publisher scripts, hosting receipts or `.cpanel.yml` were changed. The existing production deployment sequence does not publish this phase merely because these new files exist.

## Tests actually executed

Command: `python tests/test_native_experiences.py`

Result: **18 tests passed**: 10 builder checks and 8 browser contract tests. Browser: Chromium `144.0.7559.96`. Layout matrix: **64 cases** = 4 widths (320, 390, 768, 1366 CSS px) x 4 experiences x 2 appearances x 2 views. No horizontal page overflow was detected in those fixture cases.

The browser tests verify retained native DOM/canvas identity and bitmap, unchanged sample Arabic markup and disabled navigation, native button-handler continuity, per-learner appearance isolation, session fallback, all 32 selector labels/directions, Escape focus restoration, late shadow mounts, unchanged synthetic glyph/feedback colors, cleanup, and no repeated idle DOM writes after settling.

**Limitations:** the browser DOM is a synthetic native-contract fixture, not the workbook. Its glyph is a test shape, not a course glyph. Audio-button counters do not prove recorded sound playback. Persistence isolation/restore uses explicitly mocked storage; actual unavailable storage is tested separately. Network navigation was unavailable in the local browser, so no real-origin reload/offline/service-worker or authenticated paid-reader journey was tested. No physical device, other browser engine, complete course content or independent translation review is claimed. Fixture screenshots must not be presented as a delivered workbook screen.

Test log and the full 64-case JSON matrix are included in the conversation delivery package. A compact verification summary accompanies this document.

## Continue from here — no new design proposal

1. Stage the current original compiled reader in a private environment, preserving its exact checksum and native content/media access. Check selector and hidden-state compatibility before applying the adapter.
2. Exercise all six existing sections, all five public demo letters and all full letter lessons. Verify real recorded audio, source images, writing/undo/clear, choices, meanings, favorites, lesson position, language changes and learner isolation across experience changes. Keep unavailable content permissions unchanged.
3. Test actual browser storage/reopen, licensed offline behavior and original service-worker updates. Confirm every retained handler and component-specific layout rather than extrapolating from the fixture.
4. Integrate into a new scoped reversible publisher with the existing encrypted-player/manifests/receipt preservation chain. Re-read the current hosting baseline before publication. Do not use a general Deploy HEAD action as a substitute.
5. Only after the compiled-reader and publication checks pass, merge the reviewed release and publish. Record actual host checks and device/browser coverage.

## Reproduce the private staging operation

For a developer working in a private staging directory, after independently verifying the current input hash:

```sh
python scripts/stage_workbook_experiences.py \
  --input /PRIVATE-STAGING/original-workbook.js \
  --expected-sha256 VERIFIED_CURRENT_SHA256 \
  --output /PRIVATE-STAGING/native-workbook.js
```

The paths and checksum above are placeholders, not credentials or instructions for the owner to upload private keys. The output is not a public replacement file. Never commit or export a decoded licensed player.
