# Historical commerce regressions

These copies preserve the earlier schema-2 basket and standalone country-input
contracts. The current published checkout uses schema 3, product/offer selectors,
and geography inside `src/commerce/checkout.js`. Running these historical scripts
against today's `dist` mixes incompatible interfaces.

The active tests at the original paths now exercise the current scripts and
markup. `test_checkout_review.mjs` continues to cover all 32 checkout forms,
buyer validation, disabled card collection, and mocked unpaid order references.
The historical source modules remain because the base build still references
them; this archive does not establish that those modules can be removed.
