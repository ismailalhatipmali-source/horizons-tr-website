# Approved HORIZONS UI — comfort-controls implementation, phase 1

Date: 2026-10-07
Base examined: `f15b54ea37e2d0e190ea2fb0b176e2f161ad2c98`
Branch: `ui/approved-comfort-controls-20261007`

## Owner approval

The owner approved the four distinct layouts in `HORIZONS_Design_Review_01.html`: Sprout, Adventure, Discovery and Focus. The requested correction is less glaring light surfaces and clearly visible buttons/icons in each palette. Do not replace the approved layouts or reduce the experiences to colour-only variants.

## Completed in the conversation artifact

`HORIZONS_Design_Review_02.html` retains the original layouts and sample interactions, adds softer ivory/sage surfaces, explicit filled/bordered controls, stronger icon strokes, visible selection/hover/focus/disabled states, and 44px icon targets. The original preview storage key is retained. The new downloadable HTML is an isolated preview; it is not a production reader.

Actual Chromium tests using in-memory HTML rendering: 96 layout cases (four experiences x two themes x four widths x three sample stages); no JavaScript page errors or horizontal-overflow failures in these cases. Switching experiences preserved the sample progress, drawing strokes and favourite within the active session. Drawing/undo, Arabic-to-English/Turkish direction changes and the dark setting were exercised. A separate 128-case rendered-control test covered default/hover/focus/disabled states of four representative controls in all four modes and two themes. Its minimum enabled-control text contrast was 6.15:1; this is not a full accessibility audit.

Browser URL navigation was restricted in the execution environment. Tests used `set_content`, not physical devices or an authenticated production workbook. Persistent storage after reopening was not retested. The preview still has three UI languages and device speech, not all 32 translations or approved recorded audio.

## Added to this branch

- `src/workbook-experiences/reader-comfort.css`: presentation-only staging overlay targeting the existing focus-shell control selectors verified in source. It also prepares four palette tokens without introducing or selecting a new experience.
- `scripts/stage_ui_comfort.py`: builds a NEW private staging player only after an explicit input SHA-256 check and verification of the existing focus-shell markers. The original player bytes are preserved as a prefix; it appends only a style-mounting IIFE. Refuses repeated application, existing outputs, symlink outputs and common document-root destinations.
- `tests/test_stage_ui_comfort.py`: eight isolated unit tests passed for preservation and refusal cases.

Run the staging tests with `python -m unittest discover -s tests -p test_stage_ui_comfort.py -v`.

## Not published / not complete

No changes were made to `main`, `.cpanel.yml`, production publishers, manifests, inherited receipts, encrypted content, activation, payment, learner state or educational assets. This branch does not automatically deploy and must not be presented as the complete four-experience migration.

The native overlay has not been exercised inside an authenticated paid reader. It does not penetrate the blending components' shadow roots; their controls need their own scoped integration. The four approved full layouts, original course content/audio/images, all 32 translations, production progress preservation, physical devices, and production encryption/manifest/service-worker/receipt updates remain to integrate and verify.

Use the verified current player from PRIVATE staging for further work; do not place licensed plaintext or private keys in this repository. Do not replace `/learn/` with the sample HTML. Do not rerun an old publisher against modified source hashes or deploy HEAD merely because a preview was approved.

## القرار التنفيذي بالعربية

التصميم معتمد، وتصحيح السطوع والأزرار منجز في نسخة المعاينة الثانية. هذا الفرع بداية تنفيذ طبقة العرض على المصدر، وليس إعلاناً باكتمال تعميم الواجهات الأربع أو نشرها على الكراسة المدفوعة. موافقة المستخدم على التصميم محفوظة؛ لا حاجة لإعادة طلبها. تبقى مراجعة الربط الفعلي والاختبارات والنشر المحدود القابل للاسترجاع خطوات تنفيذ، وليست إعادة تصميم.
