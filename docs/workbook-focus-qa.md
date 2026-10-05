# Workbook focus UI verification

Date: 2026-10-05. Base: `b737a92068223be938edb9a13979257a2b5b7830`.
Release: `workbook-focus-20261005-r1`.

The implementation is a presentation successor for the existing workbook. It is not an alternate course or standalone replacement application. No educational assets, private course payloads, fonts, credentials or learner databases are added to this change.

## Acceptance evidence

| Requirement | Change and actual evidence | Status |
| --- | --- | --- |
| Separate home and lesson | Shared shell; cold home and real demo lesson captures on desktop, tablet and mobile | Pass in public demo |
| Compact ordinary word | Navigation bottom 570.8/620 at 1366×620; 693.8/700 at 390×700; original educational font sizing retained | Pass in Arabic default case |
| Responsive layout | 15 CSS viewport cases including the specified matrix, landscape and 390×360 reduced viewport | No page horizontal overflow or JS errors |
| Native settings and lesson panels | Controls moved rather than cloned; native modal background blocking, keyboard traversal, Escape and focus return | Pass in real demo browser and DOM regression tests |
| All languages and fonts | 32 locales ×11 new keys; 6 language samples; all5 fonts at native maximum; simulated200% educational text at320px | Keys/selected samples pass; no claim of independent translation review |
| Arabic joining at large sizes | Narrow word receives full width; oversized word uses a labelled keyboard-focusable local scroll region | Connected word and visible diacritics inspected |
| Assessment and audio | Actual decoded recording playback, completion-only progress, navigation stop, settings preservation, one quiz attempt retained; intentional503 audio failure and successful single retry; delayed300ms startup | Real demo browser tests pass |
| Drawing and stories |2 strokes unchanged through viewport rotation; undo1 and clear0; all8 actual story sentences and2 questions matched | Pass in real demo browser |
| Resume and learners | Native state preserved; opaque learner-scoped view bookmark; practice/review flags retained; browser Back after learner switch | Real demo resume + synthetic isolated-profile contract tests pass |
| Trial boundaries | All4 paid sections remain locked; five existing free chapter IDs retained; B4 label reflects full edition | Pass; no paid payload added to trial |
| B3/B4 rendering | Generic successor modules; B4 real private dataset with159 entries/27 lessons and640 configuration checks; assessment gate and zoom state browser tests | Component tests pass; B3 content fixture is synthetic |
| Content preservation |497 public teaching/media manifest entries unchanged; reverse transformation reproduces original demo bytes | Pass for public artifacts |
| Publication safeguards |16 PHP tests including encryption, exact transforms, historical pins, each write fault, concurrency and symlinks | Local gate passes; actual private server chain pending |
| Full licensed workbook | Shared shell plus exact protected-reader patch prepared | Actual end-to-end licensed application remains untested |
| Update and offline | Old tab stays stable until closed; new cached player hash verified; progress and word3 preserved; offline image/audio work with zero network requests | Pass in real demo browser |
| Production deployment | No main merge or hosting publication performed during local preparation | Pending host access and licensed gates |

## Display measurements

All before/after captures start at scroll0, same first Baa word and Arabic interface. The previous footer was fixed near the viewport bottom, so its position alone was not proof that the activity fitted.

| Viewport | Activity top before → after | Document height before → after |
| --- | --- | --- |
|1366×620 |647.6 →181 |1244 →671 |
|768×1024 |625.1 →185 |1338 →1024 |
|390×700 |809.6 →225 |1730 →792 |

The primary content, audio and navigation fit the two required Arabic default word targets. Footer credit may require a short scroll. Long content, translations, small viewports and enlarged text use natural vertical scrolling. The implementation does not promise every language and size fits one screen.

Initial cold page requests were20 before and20 after; no audio/image requests occurred at initial home boot. Resource transfer measured2,704,355 →2,753,458 bytes (+49,103 bytes, about1.8%). These are local headless-browser measurements, not a production speed benchmark. The change adds no framework or remote dependency.

## Test reproduction

First materialize authorized public demo snapshots into separate directories, preserving their `try/` names. Do not commit those snapshots or their fonts. Install Playwright and an available Chromium runtime in a QA environment. Set `HZN_CHROMIUM_EXECUTABLE` to that runtime.

```bash
HZN_DEMO_ROOT=/absolute/staging-after/try node tests/test_focus_demo_browser.cjs
HZN_DEMO_ROOT=/absolute/staging-after/try node tests/test_focus_audio_browser.cjs
HZN_DEMO_BEFORE_ROOT=/absolute/staging-before/try HZN_DEMO_AFTER_ROOT=/absolute/staging-after/try node tests/test_focus_layout_browser.cjs
HZN_DEMO_BEFORE_ROOT=/absolute/staging-before/try HZN_DEMO_AFTER_ROOT=/absolute/staging-after/try node tests/test_focus_offline_browser.cjs
HZN_AUDIO_EDGE_ONLY=1 HZN_DEMO_ROOT=/absolute/staging-after/try node tests/test_focus_audio_browser.cjs
```

Each accepts `HZN_QA_OUTPUT` for private screenshots/results. See `docs/workbook-focus-deployment.md` for build, PHP and jsdom commands. B4's pure configuration test accepts the path to authorized private `data.json`; that file is not distributed with the test.

The browser used was portable Chromium153, headless, with CSS viewport emulation. Firefox, WebKit, physical iOS/Android devices and a real software keyboard were not tested. The320px/200% check doubles educational font variables; it is explicitly a text-size simulation, not evidence of operating-system or browser zoom. Account isolation used disposable synthetic profiles in the reader contract test; real licensed learner/database integration still needs authorized staging.

## Remaining release gates

- Verify the current private B4/CM/B3/B2 receipts and run the default dry run on an authorized staging copy.
- Exercise the actual licensed application across all six sections, including its encrypted loader, learner store and offline lifecycle.
- Verify current cPanel paths and final upstream HEAD, then limited production publication and hosted smoke tests.
- Repeat the successful public-demo cache migration check on the licensed application; public and licensed workers have separate contracts.

Rollback scope and the protected manual recovery procedure are documented in `docs/workbook-focus-deployment.md`. Existing private receipts must never be edited to silence a validation error.
