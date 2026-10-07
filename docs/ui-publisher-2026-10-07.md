# Native UI publication candidate — 2026-10-07

The owner approved the four experiences and explicitly authorized live publication. No further design approval or owner screenshot/download is being requested. This record describes code and tests, **not a successful host deployment**.

## Implemented in this increment

A CLI-only publisher now reads the existing focus/trial receipts itself. Default `--check` builds and validates a six-file update in memory without writing files. `--publish` validates the predecessor chain and uses the existing private content key locally on the host: the entire original paid JavaScript is retained byte-for-byte as a prefix, the UI layer is appended, and the result is re-encrypted. No paid plaintext or key is exported or logged. Only the two players, their two manifest entries and two service workers change. Other manifest entries, educational media, activation data and learner records are outside the write allowlist.

Private backups and a durable pending journal support automatic rollback on ordinary failures, explicit rollback after success, and recovery after interruption. Unexpected concurrent edits, changed receipts, modified backups, links, invalid modes, source-hash mismatches and overlapping publication locks stop the operation rather than being overwritten.

The existing focus/trial validators now resolve exactly the updated paths to the checked private pre-UI baseline, while independently verifying the newly installed UI files. Historical receipts are not rewritten. Four bridge contract tests exercise the actual State functions before publication, after publication, after a tamper and after rollback. Historical Release source loaders are synthetic in those tests; the new UI release verifier, old demo patch and worker transformations are real.

The cPanel task is extended with one `&&` call to the new publisher **after** the original guarded shell has exited and released its lock. The original task is byte-identical when the suffix is removed (Git blob `3a8bfe2e0842a3598e6b760b269b94223584cfe9`). A failed original task prevents the new call. The new publisher re-acquires the shared production lock and still requires the production checkout, main branch and exact document root. This is a staged pipeline edit, not evidence that cPanel executed it.

## Verification actually performed locally

- 35 filesystem/encryption/publication tests passed using fresh temporary roots, synthetic player data and random test keys.
- 4 predecessor-state bridge contract tests passed.
- 3 pipeline syntax/order tests passed using harmless stand-in commands; the real host task was not executed.
- 18 existing builder/browser contract tests passed again, including 64 synthetic layout combinations. Storage in these browser fixtures is mocked.
- The actual PHP-produced UI addition (79,777 bytes) passed Node syntax checking. PHP syntax checks passed. Local PHP: 8.4.23; the host targets PHP 8.2, which has not been executed here.

Reproduce from the repository:

```sh
python3 scripts/build_native_ui_manifest.py
php tests/test_native_publication.php
php tests/test_native_chain_bridge.php
python3 tests/test_native_pipeline.py
python3 tests/test_native_experiences.py
```

A read-only GitHub Actions workflow is included for the publication/bridge/pipeline suites; workflow inclusion is not a claim that a remote CI run passed.

## Host observation and remaining limits

A read-only public probe returned HTTP 200 for the demo manifest and both service workers. The public demo's workbook was 686,860 bytes, SHA-256 `623d60b81455d790da1bd4015f8e828c2c597672fcfde9b63e9707982cd1f572`. The old focus shell was present and the new experience adapter was absent. The exact worker cache declarations observed are the declarations the publisher accepts as its baseline.

No authenticated hosting-write session is available through the tools. The real private receipt chain, real paid-key preflight, complete licensed curriculum, browser audio, reload/offline behavior and physical devices have not been verified by this increment. Filesystem fixture results do not prove those behaviors. The new code remains in draft PR 12; neither main nor the live site has been changed by this increment. Do not present a source commit, a successful synthetic test or a public-page in-memory injection as a live deployment receipt.

Before merging/deployment, complete review of the preservation chain and execute the host preflight with an authenticated execution channel. On a refused preflight, inspect the reported fixed error code; do not weaken the checks, switch the live checkout to the development branch, delete private receipts, or put a task runner/public installer in public_html. Existing authorizations are sufficient; the missing capability is working authenticated host execution, not another permission statement from the owner.
