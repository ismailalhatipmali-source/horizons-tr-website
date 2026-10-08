<?php
declare(strict_types=1);
/* Publication primitives for the approved four-experience UI.
 * CLI only. Fixed six-file allowlist. No network, shell execution, database,
 * activation change, plaintext paid-player output, or educational-media writes.
 * Not wired into .cpanel.yml until predecessor-bridge tests have passed.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
const HZN_UI_RELEASE = 'native-experiences-20261007-r1';
const HZN_UI_PATHS = [
    'try/workbook.js', 'learn/content/1.4.1/workbook.js.hzn',
    'try/demo-asset-manifest.json', 'learn/asset-manifest.json',
    'try/sw.js', 'learn/sw.js',
];
const HZN_UI_RECEIPTS = ['.horizons-workbook-focus/receipt.json', '.horizons-trial-pause/receipt.json'];
const HZN_UI_SOURCES = ['native-experiences.js', 'native-experiences.css', 'native-shadow.css', 'native-locales.json', 'native-art.json', 'native-visibility.css'];
const HZN_UI_MARKER = '/*HZN_NATIVE_EXPERIENCES_BEGIN*/';
const HZN_UI_AAD = 'horizons-arabic-level1/workbook.js';

function hznUiFail(string $code): never { throw new RuntimeException('UI_' . $code); }
function hznUiJson(array $a): string {
    return json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
function hznUiHash(string $raw): string { return hash('sha256', $raw); }
function hznUiSha(mixed $value): bool { return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1; }
function hznUiPath(string $root, string $relative = ''): string {
    if ($root === '/' || !str_starts_with($root, '/') || rtrim($root, '/') !== $root) hznUiFail('ROOT');
    // Reject links in EVERY component, including the supplied root's parents.
    $all = ltrim($root . ($relative === '' ? '' : '/' . $relative), '/');
    $path = '';
    foreach (explode('/', $all) as $part) {
        if ($part === '' || $part === '.' || $part === '..' || !preg_match('/^[a-zA-Z0-9_.-]+$/D', $part)) hznUiFail('PATH');
        $path .= '/' . $part;
        clearstatcache(true, $path);
        if (is_link($path)) hznUiFail('SYMLINK');
    }
    return $path;
}
function hznUiRoot(string $root): string {
    $p = hznUiPath($root);
    if (!is_dir($p) || realpath($p) !== $p) hznUiFail('ROOT');
    return $p;
}
function hznUiRead(string $path, ?int $mode = null, int $limit = 41943040): string {
    hznUiPath(dirname($path), basename($path));
    clearstatcache(true, $path); $s = @lstat($path);
    if (!$s || ($s['mode'] & 0170000) !== 0100000 || $s['nlink'] !== 1 || $s['size'] > $limit) hznUiFail('FILE');
    if ($mode !== null && ($s['mode'] & 0777) !== $mode) hznUiFail('MODE');
    $h = fopen($path, 'rb'); if (!$h) hznUiFail('READ');
    try {
        $opened = fstat($h);
        if (!$opened || $opened['ino'] !== $s['ino'] || $opened['dev'] !== $s['dev']) hznUiFail('RACE');
        $raw = stream_get_contents($h, $limit + 1);
        if ($raw === false || strlen($raw) !== $s['size'] || strlen($raw) > $limit) hznUiFail('READ');
    } finally { fclose($h); }
    return $raw;
}
function hznUiMatch(string $path, string $sha, int $mode): string {
    if (!hznUiSha($sha)) hznUiFail('HASH_FORMAT');
    $raw = hznUiRead($path, $mode);
    if (!hash_equals($sha, hznUiHash($raw))) hznUiFail('CONCURRENT_CHANGE');
    return $raw;
}
function hznUiMkdir(string $path): void {
    hznUiPath(dirname($path), basename($path));
    if (file_exists($path)) {
        if (!is_dir($path) || (fileperms($path) & 0777) !== 0700) hznUiFail('PRIVATE_DIRECTORY');
        return;
    }
    if (!mkdir($path, 0700) || !chmod($path, 0700)) hznUiFail('MKDIR');
}
function hznUiParents(string $base, string $relative): string {
    $current = $base;
    foreach (explode('/', dirname($relative)) as $part) {
        if ($part === '.') continue;
        $current = hznUiPath($current, $part); hznUiMkdir($current);
    }
    return hznUiPath($base, $relative);
}
function hznUiWrite(string $path, string $raw, int $mode, ?string $expected = null): void {
    hznUiRoot(dirname($path)); hznUiPath(dirname($path), basename($path));
    if ($expected === null && file_exists($path)) hznUiFail('OVERWRITE');
    if ($expected !== null) hznUiMatch($path, $expected, $mode);
    $tmp = dirname($path) . '/.hzn-ui-' . bin2hex(random_bytes(12));
    $h = fopen($tmp, 'x+b'); if (!$h) hznUiFail('TEMP');
    try {
        if (!chmod($tmp, 0600)) hznUiFail('TEMP_MODE');
        $offset = 0; $length = strlen($raw);
        while ($offset < $length) {
            $n = fwrite($h, substr($raw, $offset));
            if ($n === false || $n === 0) hznUiFail('WRITE'); $offset += $n;
        }
        if (!fflush($h) || !fsync($h) || !chmod($tmp, $mode)) hznUiFail('FLUSH');
        if ($expected === null) {
            if (file_exists($path) || is_link($path)) hznUiFail('CONCURRENT_CHANGE');
        } else hznUiMatch($path, $expected, $mode);
        hznUiPath(dirname($path), basename($path));
        if (!rename($tmp, $path)) hznUiFail('RENAME');
    } finally { fclose($h); if (is_file($tmp) && !is_link($tmp)) unlink($tmp); }
    hznUiMatch($path, hznUiHash($raw), $mode);
}
function hznUiAddon(string $repo, array $pins, array $overrides = []): string {
    if (array_keys($pins) !== HZN_UI_SOURCES) hznUiFail('SOURCE_SET');
    $blobs = [];
    foreach ($pins as $name => $sha) {
        if (!hznUiSha($sha)) hznUiFail('SOURCE_HASH');
        $raw = hznUiRead(hznUiPath($repo, $overrides[$name] ?? ('src/workbook-experiences/' . $name)), null, 1048576);
        if (!hash_equals($sha, hznUiHash($raw))) hznUiFail('SOURCE_CHANGED'); $blobs[$name] = $raw;
    }
    $copy = json_decode($blobs['native-locales.json'], true, 32, JSON_THROW_ON_ERROR);
    $languages = explode(' ', 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja');
    $languages = array_values(array_unique($languages)); sort($languages);
    $found = array_keys($copy['rows'] ?? []); sort($found);
    if ($found !== $languages || count($copy['keys'] ?? []) !== 27 || count(array_unique($copy['keys'])) !== 27) hznUiFail('LANGUAGES');
    $locales = [];
    foreach ($copy['rows'] as $lang => $row) {
        $values = explode('|', $row);
        if (count($values) !== 27 || array_filter($values, fn($v) => trim($v) === '')) hznUiFail('LANGUAGE_ROW');
        $locales[$lang] = array_combine($copy['keys'], $values);
    }
    $art = json_decode($blobs['native-art.json'], true, 16, JSON_THROW_ON_ERROR);
    $artKeys = array_keys($art); sort($artKeys);
    if ($artKeys !== ['companion', 'map']) hznUiFail('ART');
    $vars = 'body[data-hzn-experiences-ready]{';
    foreach ($art as $name => $svg) {
        if (!is_string($svg) || !str_starts_with(ltrim($svg), '<svg ') ||
            preg_match('~<(?:script|foreignObject)|\bon\w+\s*=|(?:href|src)\s*=|url\(~i', preg_replace(['~url\(\s*#[A-Za-z][A-Za-z0-9_.:-]*\s*\)~', '~(?:xlink:)?href\s*=\s*[\"\']#[A-Za-z][A-Za-z0-9_.:-]*[\"\']~'], '', $svg))) hznUiFail('ART');
        $vars .= '--hzn-approved-' . $name . ':url("data:image/svg+xml,' . rawurlencode($svg) . '");';
    }
    $payload = ['css' => $vars . "}\n" . $blobs['native-experiences.css'] . "\n" . $blobs['native-visibility.css'],
        'shadow' => $blobs['native-shadow.css'], 'locales' => $locales];
    // The outer catch restores the native presentation after synchronous mount failure.
    return "\n;" . HZN_UI_MARKER . "\n" . $blobs['native-experiences.js'] .
        "\n;try{HZNInstallExperiences(window,document," . json_encode($payload, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) .
        ");}catch(error){try{window.hznExperiences?.destroy();}catch(_){}console.warn('HORIZONS UI fallback: native reader retained');}\n/*HZN_NATIVE_EXPERIENCES_END*/\n";
}
function hznUiAppend(string $plain, string $addition, string $expected): string {
    if (!hznUiSha($expected) || !hash_equals($expected, hznUiHash($plain))) hznUiFail('PLAYER_HASH');
    if (strlen($plain) > 33554432 || strlen($plain . $addition) > 33554432 ||
        substr_count($plain, '/*WORKBOOK_FOCUS_BEGIN*/') !== 1 || substr_count($plain, '/*WORKBOOK_FOCUS_END*/') !== 1 ||
        !str_contains($plain, 'globalThis.hznFocusShell=Object.freeze') ||
        str_contains($plain, HZN_UI_MARKER) || str_contains($plain, '/*HZN_COMFORT_UI_BEGIN*/')) hznUiFail('PLAYER_CONTRACT');
    if (substr_count($addition, HZN_UI_MARKER) !== 1) hznUiFail('ADDITION');
    return $plain . $addition;
}
function hznUiDecrypt(string $cipher, string $key): string {
    if (strlen($key) !== 32 || strlen($cipher) <= 28) hznUiFail('CIPHER');
    $packed = openssl_decrypt(substr($cipher, 12, -16), 'aes-256-gcm', $key, OPENSSL_RAW_DATA,
        substr($cipher, 0, 12), substr($cipher, -16), HZN_UI_AAD);
    if ($packed === false) hznUiFail('AUTHENTICATION_TAG');
    $plain = gzdecode($packed, 33554432);
    if ($plain === false || strlen($plain) > 33554432) hznUiFail('DECOMPRESSION');
    return $plain;
}
function hznUiEncrypt(string $plain, string $key): string {
    if (strlen($key) !== 32 || strlen($plain) > 33554432) hznUiFail('CIPHER');
    $iv = random_bytes(12); $tag = ''; $packed = gzencode($plain, 9);
    if ($packed === false) hznUiFail('COMPRESSION');
    $bytes = openssl_encrypt($packed, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, HZN_UI_AAD, 16);
    if ($bytes === false) hznUiFail('ENCRYPTION');
    $out = $iv . $bytes . $tag;
    if (hznUiDecrypt($out, $key) !== $plain) hznUiFail('ENCRYPTION_ROUNDTRIP');
    return $out;
}
function hznUiWorker(string $raw, bool $paid, bool $legacy = false, string $single = 'compact-20261008-r4'): string {
    if (str_contains($raw, HZN_UI_RELEASE)) hznUiFail('WORKER_ALREADY_UPDATED');
    $old = $paid ? "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1-blending4-20261004-r1-workbook-focus-20261005-r1-trial-pause-20261005-r1';" :
        "const CACHE='hzn-public-demo-'+VERSION+'-workbook-focus-20261005-r1';";
    if (substr_count($raw, $old) !== 1) hznUiFail('WORKER_BASELINE');
    $suffix = HZN_UI_RELEASE . ($legacy ? '' : '-' . $single);
    $new = $paid ? substr($old, 0, -2) . '-' . $suffix . "';" : "const CACHE='hzn-public-demo-'+VERSION+'-" . $suffix . "';";
    $after = str_replace($old, $new, $raw);
    if (!$paid) {
        $pattern = '(?:creator-credit|demo-experience|comprehensive-meaning|workbook-focus)';
        if (substr_count($after, $pattern) !== 1) hznUiFail('WORKER_MEDIA_REUSE');
        $after = str_replace($pattern, '(?:creator-credit|demo-experience|comprehensive-meaning|workbook-focus|native-experiences)', $after);
    }
    return $after;
}
function hznUiManifest(string $raw, string $beforeApp, string $afterApp, bool $paid, ?int $decoded = null): string {
    $before = json_decode($raw, true, 64, JSON_THROW_ON_ERROR); $after = $before;
    $entry = $before['files']['workbook.js'] ?? [];
    if (($entry['sha256'] ?? '') !== hznUiHash($beforeApp) || ($entry['bytes'] ?? -1) !== strlen($beforeApp)) hznUiFail('MANIFEST_BASELINE');
    if ($paid && (($before['product'] ?? '') !== 'horizons-arabic-level1' || ($entry['encoding'] ?? '') !== 'gzip' ||
        ($entry['url'] ?? '') !== 'content/1.4.1/workbook.js.hzn' || !is_int($decoded) || $decoded < 1 || $decoded > 33554432)) hznUiFail('MANIFEST_PAID');
    if (!$paid && ($before['edition'] ?? '') !== 'demo') hznUiFail('MANIFEST_DEMO');
    $after['files']['workbook.js']['sha256'] = hznUiHash($afterApp);
    $after['files']['workbook.js']['bytes'] = strlen($afterApp);
    if ($paid) $after['files']['workbook.js']['decoded_bytes'] = $decoded;
    $projection = $after; $projection['files']['workbook.js'] = $entry;
    if ($projection !== $before) hznUiFail('CONTENT_PROJECTION');
    return hznUiJson($after) . "\n";
}
function hznUiSnapshot(string $web): array {
    hznUiRoot($web); $result = [];
    foreach (HZN_UI_PATHS as $p) {
        $raw = hznUiRead(hznUiPath($web, $p), 0644);
        $result[$p] = ['bytes' => $raw, 'sha256' => hznUiHash($raw), 'mode' => 0644];
    }
    return $result;
}
function hznUiInherited(string $home): array {
    $hashes = [];
    foreach (HZN_UI_RECEIPTS as $p) $hashes[$p] = hznUiHash(hznUiRead(hznUiPath($home, $p), 0600, 262144));
    return $hashes;
}
function hznUiCheckInherited(string $home, array $hashes): void {
    if (array_keys($hashes) !== HZN_UI_RECEIPTS) hznUiFail('RECEIPT_SET');
    foreach ($hashes as $p => $sha) hznUiMatch(hznUiPath($home, $p), $sha, 0600);
}
function hznUiFixed(array $items): void {
    if (array_keys($items) !== HZN_UI_PATHS) hznUiFail('TARGET_SET');
}
/* Library entry point; caller MUST have verified the installed predecessor chain
 * and the semantic payload via the planner. There is deliberately no web endpoint.
 * Checkpoints exist for local fault-injection tests only, never as CLI flags.
 */
function hznUiPublish(string $web, array $before, array $after, array $inherited, array $metadata,
    callable $verify, ?callable $checkpoint = null): array {
    hznUiRoot($web); hznUiFixed($before); hznUiFixed($after);
    foreach ($after as $p => $raw) if (!is_string($raw) || strlen($raw) < 1 || strlen($raw) > 41943040 || ($before[$p]['mode'] ?? 0) !== 0644) hznUiFail('PAYLOAD');
    $home = dirname($web); $private = hznUiPath($home, '.horizons-native-ui'); hznUiMkdir($private);
    $lockPath = hznUiPath($private, 'publish.lock');
    if (file_exists($lockPath)) hznUiRead($lockPath, 0600, 128);
    $lock = fopen($lockPath, 'c+b'); if (!$lock) hznUiFail('LOCK');
    if (!chmod($lockPath, 0600) || !flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); hznUiFail('BUSY'); }
    $written = []; $txn = null; $pending = hznUiPath($private, 'pending.json'); $active = hznUiPath($private, 'receipt.json');
    try {
        if (file_exists($active) || file_exists($pending)) hznUiFail('EXISTING_TRANSACTION');
        hznUiCheckInherited($home, $inherited);
        foreach ($before as $p => $row) hznUiMatch(hznUiPath($web, $p), $row['sha256'], 0644);
        $txid = bin2hex(random_bytes(12)); $txn = hznUiPath($private, 'tx-' . $txid); hznUiMkdir($txn);
        hznUiMkdir(hznUiPath($txn, 'before'));
        $record = ['schema' => 1, 'release' => HZN_UI_RELEASE, 'transaction' => $txid, 'before' => [], 'after' => [], 'inherited' => $inherited, 'metadata' => $metadata];
        foreach (HZN_UI_PATHS as $p) {
            if (hznUiHash($before[$p]['bytes']) !== $before[$p]['sha256']) hznUiFail('SNAPSHOT');
            hznUiWrite(hznUiParents($txn . '/before', $p), $before[$p]['bytes'], 0600);
            $record['before'][$p] = $before[$p]['sha256']; $record['after'][$p] = hznUiHash($after[$p]);
        }
        hznUiWrite($pending, hznUiJson($record) . "\n", 0600);
        if ($checkpoint) $checkpoint(0);
        // Applications first, manifests next, workers last. New workers wait for old tabs.
        foreach (HZN_UI_PATHS as $p) {
            hznUiCheckInherited($home, $inherited);
            hznUiWrite(hznUiPath($web, $p), $after[$p], 0644, $before[$p]['sha256']); $written[] = $p;
            if ($checkpoint) $checkpoint(count($written));
        }
        hznUiCheckInherited($home, $inherited);
        hznUiWrite($active, hznUiJson($record) . "\n", 0600);
        $verify($record);
        foreach ($record['after'] as $p => $sha) hznUiMatch(hznUiPath($web, $p), $sha, 0644);
        hznUiCheckInherited($home, $inherited);
        if (!rename($pending, $txn . '/published.json')) hznUiFail('JOURNAL_FINALIZE');
        return $record;
    } catch (Throwable $e) {
        // A write can fail after rename. Inspect all six, not only calls that returned.
        // Never roll back anything when a later writer left unexpected bytes.
        if (isset($record) && file_exists($pending)) {
            $restore = []; $safe = true;
            try {
                hznUiCheckInherited($home, $inherited);
                foreach (HZN_UI_PATHS as $p) {
                    $now = hznUiHash(hznUiRead(hznUiPath($web, $p), 0644));
                    hznUiMatch(hznUiPath($txn, 'before/' . $p), $record['before'][$p], 0600);
                    if (!in_array($now, [$record['before'][$p], $record['after'][$p]], true)) hznUiFail('RECOVERY_CONFLICT');
                    if ($now === $record['after'][$p] && $now !== $record['before'][$p]) $restore[] = $p;
                }
                if (file_exists($active) && hznUiRead($active, 0600) !== hznUiJson($record) . "\n") hznUiFail('RECOVERY_CONFLICT');
            } catch (Throwable $ignored) { $safe = false; }
            if ($safe) foreach (array_reverse($restore) as $p) try {
                hznUiWrite(hznUiPath($web, $p), $before[$p]['bytes'], 0644, $record['after'][$p]);
            } catch (Throwable $ignored) { $safe = false; break; }
            if (!$safe) hznUiFail('RECOVERY_REQUIRED');
            if (file_exists($active) && !rename($active, $txn . '/failed-receipt.json')) hznUiFail('RECOVERY_REQUIRED');
            if (!rename($pending, $txn . '/aborted.json')) hznUiFail('RECOVERY_REQUIRED');
        }
        throw $e;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
/* One recovery implementation for interrupted transactions and explicit rollback.
 * A pending rollback is durable before restoring; reruns tolerate mixed known bytes.
 * No flags permit overwriting a foreign change, invalid receipt or modified backup.
 */
function hznUiRestore(string $web, bool $rollback = false): void {
    hznUiRoot($web); $home = dirname($web); $private = hznUiPath($home, '.horizons-native-ui');
    hznUiRoot($private);
    if ((fileperms($private) & 0777) !== 0700) hznUiFail('PRIVATE_DIRECTORY');
    $lockPath = hznUiPath($private, 'publish.lock'); hznUiRead($lockPath, 0600, 128);
    $lock = fopen($lockPath, 'r+b'); if (!$lock) hznUiFail('LOCK');
    if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); hznUiFail('BUSY'); }
    try {
        $pending = hznUiPath($private, 'pending.json'); $active = hznUiPath($private, 'receipt.json');
        if ($rollback && file_exists($pending)) hznUiFail('RECOVERY_REQUIRED');
        $raw = hznUiRead($rollback ? $active : $pending, 0600, 262144);
        $r = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (($r['schema'] ?? '') !== 1 || ($r['release'] ?? '') !== HZN_UI_RELEASE || !preg_match('/^[a-f0-9]{24}$/D', $r['transaction'] ?? '')) hznUiFail('JOURNAL');
        if (file_exists($active) && hznUiRead($active, 0600) !== $raw) hznUiFail('RECEIPT_CONFLICT');
        hznUiFixed($r['before']); hznUiFixed($r['after']); hznUiCheckInherited($home, $r['inherited']);
        $txn = hznUiPath($private, 'tx-' . $r['transaction']); $restore = [];
        foreach (HZN_UI_PATHS as $p) {
            $backup = hznUiMatch(hznUiPath($txn, 'before/' . $p), $r['before'][$p], 0600);
            $sha = hznUiHash(hznUiRead(hznUiPath($web, $p), 0644));
            if (!hznUiSha($r['after'][$p]) || !in_array($sha, [$r['before'][$p], $r['after'][$p]], true) ||
                ($rollback && $sha !== $r['after'][$p])) hznUiFail('RECOVERY_CONFLICT');
            if ($sha === $r['after'][$p] && $sha !== $r['before'][$p]) $restore[$p] = $backup;
        }
        if ($rollback) hznUiWrite($pending, $raw, 0600);
        foreach (array_reverse($restore, true) as $p => $bytes) {
            hznUiCheckInherited($home, $r['inherited']);
            hznUiWrite(hznUiPath($web, $p), $bytes, 0644, $r['after'][$p]);
        }
        foreach ($r['before'] as $p => $sha) hznUiMatch(hznUiPath($web, $p), $sha, 0644);
        if (file_exists($active) && !rename($active, $txn . '/retired-receipt.json')) hznUiFail('JOURNAL_FINALIZE');
        if (!rename($pending, $txn . '/recovered-' . bin2hex(random_bytes(6)) . '.json')) hznUiFail('JOURNAL_FINALIZE');
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function hznUiRecover(string $web): void { hznUiRestore($web); }
function hznUiRollback(string $web): void { hznUiRestore($web, true); }
