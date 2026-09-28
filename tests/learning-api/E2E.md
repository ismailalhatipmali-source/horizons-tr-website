# Full client / PHP integration fixture

`e2e-router.php` is **test only** and is not part of `src/learning-api/` or any deployment. It accepts loopback requests under PHP's CLI development server only. The document root must be an isolated `/tmp/horizons-*/public_html`. Never point it at a production registry.

Prepare the full current `/learn/` web release in that temporary document root. Then launch:

```sh
HZN_E2E_DOCROOT=/tmp/horizons-online-e2e/public_html \
HZN_E2E_VAULT=/absolute/private/source/private/owner-vault.json \
HZN_E2E_ACTIVATION_CORE=/absolute/private/source/backend/app/Core.php \
/path/to/php -S 127.0.0.1:8765 \
-t /tmp/horizons-online-e2e/public_html \
/absolute/repository/tests/learning-api/e2e-router.php
```

Use separate browser contexts for separate devices. In each context:

```js
const core = await import('/learn/license-core.js');
const identity = await core.createIdentity();
const {license} = await fetch('/__fixture__/activate', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({account:'A',device_id:identity.device_id,public_key:identity.public_key})
}).then(r=>r.json());
// Validate the real signed license before seeding the ordinary activation record.
await core.validateAndUnlock(license, identity);
const db = await new Promise((resolve,reject)=>{
  const r=indexedDB.open('horizons-web-license-v1',1);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
await new Promise((resolve,reject)=>{
  const tx=db.transaction('kv','readwrite');
  tx.objectStore('kv').put({envelope:license,device_id:identity.device_id},'activation');
  tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
});
db.close();
```

Lifetime fixture licenses do not require a timed-license clock record. Fixture account `A` and `B` are independent; each allows three registered synthetic devices. The fixture uses the existing private signing vault only to issue valid test licenses. It creates **only** a marked synthetic activation registry at the temporary home's `horizons-license/`; no SMTP, email, purchases, private vault copying or production database writes occur.

The production API bootstrap, signature pin, RSA challenge, browser private key, bearer session, registry lookups and progress persistence are then exercised unchanged. The router substitutes HTTPS metadata solely for loopback testing; production keeps its HTTPS requirement. Finish by stopping the PHP process and removing the entire temporary test home, which contains synthetic licenses, registries and keys.

The complete real-browser test is `tests/test_online_e2e.mjs`. It starts and stops
its own PHP child process so the server and Chromium share a network namespace.
Set the three `HZN_E2E_*` paths above plus:

- `E2E_BASE_URL=http://127.0.0.1:8765`
- `E2E_PHP`: absolute PHP executable path
- `E2E_CHROMIUM`: absolute Chromium executable path
- `E2E_CHROMIUM_ARGS`: optional JSON array of runtime flags (unsafe web-security
  overrides and single-process mode are always removed)
- `E2E_OUTPUT`: optional temporary report directory

Then run `node tests/test_online_e2e.mjs`. Playwright must be installed; the Codex
runtime's `CODEX_PRIMARY_RUNTIME_NODE_MODULES` is supported. A repeat run removes
only a prior synthetic registry carrying `E2E-SYNTHETIC-ONLY` and its adjacent
fixture progress data. Keep this fixture separate from every real account.

The fixture also accepts integer `schema: 2` in the activation request to test
legacy-license account discovery with a valid signature. A validated
`hzn_fixture_delay` cookie matching an encrypted MP3 basename enables a bounded
1.5-second delay for the UI responsiveness test. Neither capability is present
in the production API or copied by deployment scripts.
