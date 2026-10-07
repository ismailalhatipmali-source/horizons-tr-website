# UI integration follow-up — 2026-10-07

Owner direction: continue without asking the owner for further screenshots, file downloads, or hosting-navigation steps. This record is evidence of completed work, not a production deployment receipt.

## Public-reader observation actually performed

An isolated Firecrawl browser reached `https://horizons-tr.com/try/`. The real public reader loaded; `window.hznFocusShell` was defined and `window.hznExperiences` initially was not. The visible free lesson was Baa, with its real word/sentence illustrations, and the native Words / Listen and choose / Stories / Write navigation.

The five presentation sources at `e83ecd6991ed4fc11e9beb6933f31aa90cdc6ac9` were fetched in that isolated environment and their SHA-256 values matched the locally retained source. The presentation adapter was injected into the browser's memory only. Its snapshot reported `mounted: true`. Subsequent read-only inspection confirmed the four-choice dialog (Sprout, Adventure, Discovery, Focus), light/dark options, and native lesson behind it.

This was not server publication. It does not establish complete four-mode behavior, real recorded-audio playback, protected-reader compatibility, or correct persistence after reload. A requested automated multi-state browser test was blocked by the tool safety layer; it was not retried via a different encoding or execution route. Further remote interaction was limited to a read-only inspection.

## Code completed

Added `src/workbook-experiences/native-visibility.css` and included it in the private staging builder's hashed source set. The guard preserves native `hidden` flags on the home section, stage navigation, and compact stage menu despite author-level grid/flex/block rules. It changes no curriculum, licence decisions, event handlers, or saved progress.

A local native-compatible regression fixture reproduced hidden-home exposure before the fix (Focus, width 390). The old synthetic fixture had supplied a global `hidden !important` rule and an extra home-hiding selector, masking that failure. The regression passes after the guard is included. This reproduction is not a claim that the defect was observed in every live browser.

Added enabled-control contrast checks across all four modes and both appearances: 32 tested state/control combinations, text contrast at least 4.5 and declared minimum control height at least 44 CSS pixels in that fixture.

## Verification

Command: `python -m unittest discover -s tests -p 'test_native*.py' -v`.

Final result: **21 tests discovered; 20 passed; 1 skipped**. Existing layout coverage remains 64 synthetic cases. The opt-in real-origin storage test could not be executed: the local browser runtime returned `ERR_BLOCKED_BY_ADMINISTRATOR` for loopback-origin navigation. No policy was disabled and no persistence-after-reload success is claimed.

The three committed code/test blob hashes were read back and matched the locally tested bytes at `b095d0e3f2e79156f108f2e48936eb803b25db91`:

- native-visibility.css: `8e57629dae7835142acace4e70bfc8fa3a5a4889`
- stage_workbook_experiences.py: `493f841f997d069b1cb67dbc6e842cfc05647933`
- test_native_visibility.py: `a5786a965c39c504df6f47e183ab135e2402e050`

## Remaining boundary

No authenticated hosting write session is available in the tools. The protected full reader and its private content have not been integration-tested. A preservation-chain-aware production publisher is still not completed. No production index, encrypted asset, manifest, service worker, receipt, activation/payment record, or `.cpanel.yml` was changed; no branch was merged or deployed. Keep PR 12 in draft. The owner should not be told that only pressing Deploy HEAD remains.
