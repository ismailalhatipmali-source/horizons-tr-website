# Host-verified local authorization policy

The previous root URI Rewrite/If policy failed on the actual LiteSpeed host and was rolled back. It must not be reapplied. The October 6 host session instead verified local FilesMatch authorization in assets, downloads, updates, try, and learn/content; inert PHP probes returned 403 while control HTML remained readable. The limited root sensitive-file guard was verified separately. No PHP handler, runtime INI, application source, or credentials were changed by those guards.

## Source persistence

`src/security/static.htaccess` is the exact 193-byte host-verified child policy (SHA-256 ddf5fc3fb8bda845bd52db8252e12352463c621f4df2e9322c2ab43c79595a88). `src/security/public.htaccess` contains only the host-verified root FilesMatch expression under the existing managed-policy markers. `dist/.htaccess` uses that limited root policy, without the failed URI Rewrite/If rules.

`deploy-cpanel.sh` stages all five child policies before any public writes. It includes try and learn/content in the replacement trees and publishes assets/downloads/updates child policies through the existing file journal. Missing/unsafe source policies, symlink destinations, and differing existing or packaged child rules stop publication for operator review. Existing custom rules are not silently replaced. The manual root LOCAL SENSITIVE FILE GUARD block migrates once into the canonical source policy; malformed markers fail before publication.

The existing `.cpanel.yml` product/mail chain is unchanged. Updating source does not authorize an unverified full product deployment. The root-only `deploy-hardening.php apply` remains a root-only operation; it does not install the five child guards or disable PHP URL inclusion. Its status/restore operations and retained backup verification remain useful for prior batches. Do not represent root-only apply as complete host hardening. Review the historical October 6 document as history, not current execution instructions.

## Verification

The isolated GitHub Actions job has contents-read permission, no persisted checkout credentials, no host credentials, and no deployment steps. It runs syntax checks, release reconstruction/publication fixtures, repeat/rollback/conflict/symlink tests, and real Apache requests against inert synthetic content. CI success is separate from live LiteSpeed enforcement, already evidenced by the October 6 host receipt. Complete new CI before advancing main.

## Remaining host configuration

The actual web SAPI was litespeed. allow_url_include was globally and locally 1 with INI_SYSTEM access=4, loaded from /opt/cpanel/ea-php82/root/etc/php.ini; the account's php.ini Off did not affect it. A private INI containing allow_url_include=Off is prepared under /home2/horizonstr/.horizons-php-ini. The hosting administrator must bind the private scan directory to the correct account/vhost while preserving the original extension scan directories, restart account PHP appropriately, and verify the web runtime. Keep allow_url_fopen and the PHP handler/version unchanged. Source policy changes do not solve that server-layer setting.

The root policy does not claim general VCS-directory authorization. Do not publish VCS directories; the publisher rejects .git/.svn/.hg metadata anywhere in dist or release archives, as well as runtime/private web overlays. Current limited host filename searches found no .git, but they are not a complete symlink inventory. Account credential rotation and complete audio/offline/account testing remain separate tasks.
