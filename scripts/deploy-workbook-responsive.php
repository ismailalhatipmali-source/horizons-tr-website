<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0');
ini_set('log_errors', '0');
umask(0077);
require_once __DIR__ . '/blending3-preservation.php';
require_once __DIR__ . '/blending2-preservation.php';
require_once __DIR__ . '/workbook-responsive-preservation.php';
function hznResponsiveWrite(string $path, string $bytes, int $mode): void {
    $temp = $path . '.responsive-' . bin2hex(random_bytes(6));
    try {
        if (file_put_contents($temp, $bytes) !== strlen($bytes) || !chmod($temp, $mode) || !rename($temp, $path)) {
            throw new RuntimeException('RESPONSIVE_WRITE_FAILED');
        }
    } finally { if (is_file($temp)) unlink($temp); }
}
function hznResponsiveDecrypt(string $bytes, string $key): string {
    $plain = strlen($bytes) > 28 ? openssl_decrypt(substr($bytes, 12, -16), 'aes-256-gcm', $key, OPENSSL_RAW_DATA,
        substr($bytes, 0, 12), substr($bytes, -16), 'horizons-arabic-level1/workbook.js') : false;
    if ($plain === false) throw new RuntimeException('RESPONSIVE_DECRYPT_FAILED');
    return $plain;
}
$lock = null; $changed = []; $originals = []; $qaDirectory = null; $qaDirectoryMode = null; $qaDirectoryChanged = false;
try {
    $input = $argv[1] ?? '';
    if ($input === '' || is_link($input) || !($web = realpath($input)) || !is_dir($web)) throw new RuntimeException('INVALID_ROOT');
    $repo = realpath(dirname(__DIR__));
    if (!$repo || str_starts_with($repo . '/', $web . '/') || str_starts_with($web . '/', $repo . '/')) throw new RuntimeException('INVALID_ROOT');
    $home = dirname($web); $learn = hznB3Path($web, 'learn');
    $private = hznB3Path($home, '.horizons-workbook-responsive');
    if (!is_dir($private) && !mkdir($private, 0700)) throw new RuntimeException('RESPONSIVE_PRIVATE_STATE_FAILED');
    if (realpath($private) !== $private || (fileperms($private) & 0777) !== 0700) throw new RuntimeException('RESPONSIVE_PRIVATE_STATE_REQUIRED');
    $lock = fopen(hznB3Path($private, 'deploy.lock'), 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('DEPLOYMENT_BUSY');
    $sourceNames = ['src/workbook-web/responsive-workbook.css', 'src/workbook-web/blending3-responsive.css', 'src/workbook-web/blending3-component.js', 'src/workbook-web/layout-check.html'];
    $sources = []; $sourceHashes = [];
    foreach ($sourceNames as $name) {
        $path = hznB3Path($repo, $name);
        if (!is_file($path) || filesize($path) < 100 || filesize($path) > 262144) throw new RuntimeException('RESPONSIVE_GENERIC_SOURCE_REQUIRED');
        $sources[$name] = hznB3Read($path); $sourceHashes[$name] = hash('sha256', $sources[$name]);
    }
    $installed = hznB3State($web);
    if (!$installed || !hznBlending2SupersedingState($web)) throw new RuntimeException('APPROVED_SECTION04_REQUIRED');
    if ($installed['responsive_receipt'] !== null) {
        if ($installed['responsive_receipt']['sources'] !== $sourceHashes) throw new RuntimeException('RESPONSIVE_SOURCE_REVISION_CHANGED');
        echo "OK: WORKBOOK_RESPONSIVE_UI; 0 files updated; approved sections and recordings preserved.\n";
        exit(0);
    }
    $manifestPath = hznB3Path($learn, 'asset-manifest.json');
    $workerPath = hznB3Path($learn, 'sw.js');
    $appPath = hznB3Path($learn, 'content/1.4.1/workbook.js.hzn');
    $manifestRaw = hznB3Read($manifestPath); $worker = hznB3Read($workerPath); $cipherBefore = hznB3Read($appPath);
    $manifest = json_decode($manifestRaw, true, 32, JSON_THROW_ON_ERROR);
    $configPointer = require hznB3Path($web, 'activation/config-path.php');
    if (!is_string($configPointer) || is_link($configPointer) || !($configReal = realpath($configPointer))
        || !str_starts_with($configReal, $home . '/') || str_starts_with($configReal, $web . '/')) throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
    ob_start(); try { $config = require $configReal; } finally { ob_end_clean(); }
    $vaultPath = $config['vault_path'] ?? '';
    if (!is_string($vaultPath) || is_link($vaultPath) || !($vaultReal = realpath($vaultPath))
        || !str_starts_with($vaultReal, $home . '/') || str_starts_with($vaultReal, $web . '/')) throw new RuntimeException('PRIVATE_VAULT_REQUIRED');
    $vault = json_decode(hznB3Read($vaultReal), true, 8, JSON_THROW_ON_ERROR);
    $key = base64_decode($vault['content_key'] ?? '', true);
    if (($vault['product'] ?? '') !== 'horizons-arabic-level1' || !is_string($key) || strlen($key) !== 32) throw new RuntimeException('INVALID_VAULT');
    $compressed = hznResponsiveDecrypt($cipherBefore, $key);
    $app = gzdecode($compressed, 33554432);
    if ($app === false || strlen($app) !== $manifest['files']['workbook.js']['decoded_bytes']
        || !hash_equals($installed['receipt']['plain_workbook_sha256'], hash('sha256', $app))) throw new RuntimeException('RESPONSIVE_APPLICATION_BASELINE_CHANGED');
    $startToken = 'function mountBlending3Component(root,DATA,config){';
    $endToken = "\nconst B3_QUAD_TITLES=";
    if (substr_count($app, $startToken) !== 1 || substr_count($app, $endToken) !== 1 || str_contains($app, '/*WORKBOOK_RESPONSIVE_UI_BEGIN*/')) {
        throw new RuntimeException('RESPONSIVE_APPLICATION_HOOK_CHANGED');
    }
    $start = strpos($app, $startToken); $end = strpos($app, $endToken, $start);
    if ($end === false) throw new RuntimeException('RESPONSIVE_APPLICATION_HOOK_CHANGED');
    $oldComponent = substr($app, $start, $end - $start);
    if (hash('sha256', $oldComponent) !== '2eb3e53d101a74761f6117d0609f44773b977fff068461cf005a14bdac60f182') {
        throw new RuntimeException('RESPONSIVE_COMPONENT_BASELINE_CHANGED');
    }
    $componentSource = $sources[$sourceNames[2]];
    $componentStart = strpos($componentSource, $startToken);
    if ($componentStart === false || !preg_match('~\A\s*(?:(?://[^\n]*\n|/\*.*?\*/)\s*)*\z~s', substr($componentSource, 0, $componentStart))) {
        throw new RuntimeException('RESPONSIVE_COMPONENT_INVALID');
    }
    $newComponent = rtrim(substr($componentSource, $componentStart), "\r\n") . "\n";
    if (!str_starts_with($newComponent, $startToken) || substr_count($newComponent, $startToken) !== 1
        || str_contains($newComponent, 'const BLENDING3_DATA=') || str_contains($newComponent, $endToken)) throw new RuntimeException('RESPONSIVE_COMPONENT_INVALID');
    $oldShadow = "shadow.innerHTML='<style>'+BLENDING3_CSS+'</style>'+BLENDING3_MARKUP;";
    $newShadow = "shadow.innerHTML='<style>'+BLENDING3_CSS+" . json_encode($sources[$sourceNames[1]], JSON_HEX_TAG | JSON_THROW_ON_ERROR) . "+'</style>'+BLENDING3_MARKUP;";
    $tail = "\ninit();\n\n})();";
    if (substr_count($app, $oldShadow) !== 1 || substr_count($app, $tail) !== 1) throw new RuntimeException('RESPONSIVE_APPLICATION_HOOK_CHANGED');
    $extension = "\n/*WORKBOOK_RESPONSIVE_UI_BEGIN*/\nconst hznResponsiveStyle=document.createElement('style');\nhznResponsiveStyle.dataset.horizonsUi='" . HZN_RESPONSIVE_RELEASE . "';\nhznResponsiveStyle.textContent="
        . json_encode($sources[$sourceNames[0]], JSON_HEX_TAG | JSON_THROW_ON_ERROR) . ";\ndocument.head.appendChild(hznResponsiveStyle);\n/*WORKBOOK_RESPONSIVE_UI_END*/\n";
    $updated = str_replace($oldComponent, $newComponent, $app);
    $updated = str_replace($oldShadow, $newShadow, $updated);
    $updated = str_replace($tail, $extension . $tail, $updated);
    $restored = str_replace($extension . $tail, $tail, $updated);
    $restored = str_replace($newShadow, $oldShadow, $restored);
    $restored = str_replace($newComponent, $oldComponent, $restored);
    if ($restored !== $app || strlen($updated) > 33554432) throw new RuntimeException('RESPONSIVE_CONTENT_PRESERVATION_FAILED');
    $packed = gzencode($updated, 9); if ($packed === false) throw new RuntimeException('RESPONSIVE_COMPRESSION_FAILED');
    $nonce = random_bytes(12); $tag = '';
    $cipher = openssl_encrypt($packed, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, 'horizons-arabic-level1/workbook.js', 16);
    if ($cipher === false) throw new RuntimeException('RESPONSIVE_ENCRYPT_FAILED');
    $cipher = $nonce . $cipher . $tag;
    if (hznResponsiveDecrypt($cipher, $key) !== $packed) throw new RuntimeException('RESPONSIVE_ENCRYPT_CHECK_FAILED');
    $manifest['files']['workbook.js']['sha256'] = hash('sha256', $cipher);
    $manifest['files']['workbook.js']['bytes'] = strlen($cipher);
    $manifest['files']['workbook.js']['decoded_bytes'] = strlen($updated);
    $oldWorker = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2';";
    $newWorker = "const SHELL = 'hzn-web-shell-' + VERSION + '-" . HZN_RESPONSIVE_WORKER_SUFFIX . "';";
    if (substr_count($worker, $oldWorker) !== 1) throw new RuntimeException('RESPONSIVE_WORKER_HOOK_CHANGED');
    $writes = [$appPath => $cipher, $manifestPath => hznResponsiveJson($manifest) . "\n", $workerPath => str_replace($oldWorker, $newWorker, $worker)];
    $hashes = [];
    foreach (['asset-manifest.json', 'sw.js', 'content/1.4.1/workbook.js.hzn'] as $relative) $hashes[$relative] = hash('sha256', $writes[hznB3Path($learn, $relative)]);
    // This standalone public QA page uses synthetic examples only. It is not
    // part of the paid asset manifest or the ordinary learner navigation.
    $qaDirectory = hznB3Path($learn, 'layout-check');
    if (file_exists($qaDirectory) && !is_dir($qaDirectory)) throw new RuntimeException('RESPONSIVE_QA_DIRECTORY_INVALID');
    if (is_dir($qaDirectory)) {
        $qaEntries = scandir($qaDirectory);
        if ($qaEntries === false) throw new RuntimeException('RESPONSIVE_QA_DIRECTORY_INVALID');
        $qaEntries = array_values(array_diff($qaEntries, ['.', '..']));
        if ($qaEntries !== [] && $qaEntries !== ['index.html']) throw new RuntimeException('RESPONSIVE_QA_DIRECTORY_INVALID');
    }
    $qaDirectoryMode = is_dir($qaDirectory) ? fileperms($qaDirectory) & 07777 : null;
    $writes[hznB3Path($qaDirectory, 'index.html')] = $sources[$sourceNames[3]];
    $writes[hznB3Path($private, 'baseline-manifest.json')] = $manifestRaw;
    $writes[hznB3Path($private, 'baseline-sw.js')] = $worker;
    $writes[hznB3Path($private, 'baseline-workbook.hzn')] = $cipherBefore;
    $writes[hznB3Path($private, 'receipt.json')] = hznResponsiveJson(['schema' => 1, 'patch' => HZN_RESPONSIVE_RELEASE,
        'worker_suffix' => HZN_RESPONSIVE_WORKER_SUFFIX, 'original_blending3_receipt_sha256' => hash_file('sha256', hznB3Path($home, '.horizons-blending3/receipt.json')),
        'plain_before_sha256' => hash('sha256', $app), 'plain_after_sha256' => hash('sha256', $updated), 'hashes' => $hashes, 'sources' => $sourceHashes,
        'public_qa' => ['relative' => 'layout-check/index.html', 'sha256' => $sourceHashes[$sourceNames[3]]]]) . "\n";
    foreach ($writes as $path => $bytes) $originals[$path] = ['bytes' => is_file($path) ? hznB3Read($path) : null, 'mode' => is_file($path) ? fileperms($path) & 0777 : null];
    $backup = hznB3Path($private, 'backup-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)));
    if (!mkdir($backup, 0700)) throw new RuntimeException('RESPONSIVE_BACKUP_FAILED');
    foreach ($originals as $path => $entry) if ($entry['bytes'] !== null) hznResponsiveWrite($backup . '/' . hash('sha256', $path), $entry['bytes'], 0600);
    hznResponsiveWrite($backup . '/paths.json', hznResponsiveJson(array_keys($originals)) . "\n", 0600);
    foreach ($writes as $path => $bytes) {
        if ($path === $qaDirectory . '/index.html' && !$qaDirectoryChanged) {
            if (!is_dir($qaDirectory) && !mkdir($qaDirectory, 0755)) throw new RuntimeException('RESPONSIVE_QA_DIRECTORY_FAILED');
            $qaDirectoryChanged = true;
            if (!chmod($qaDirectory, 0755)) throw new RuntimeException('RESPONSIVE_QA_DIRECTORY_FAILED');
        }
        if (($originals[$path]['bytes'] !== null && hznB3Read($path) !== $originals[$path]['bytes'])
            || ($originals[$path]['bytes'] === null && file_exists($path))) throw new RuntimeException('RESPONSIVE_TARGET_CHANGED');
        hznResponsiveWrite($path, $bytes, str_starts_with($path, $learn . '/') ? 0644 : 0600); $changed[] = $path;
    }
    hznB3State($web); hznBlending2SupersedingState($web);
    echo "OK: WORKBOOK_RESPONSIVE_UI; encrypted interface updated; 150 recordings and all previous sections preserved.\n";
} catch (Throwable $error) {
    foreach (array_reverse($changed) as $path) {
        try { if ($originals[$path]['bytes'] === null) unlink($path); else hznResponsiveWrite($path, $originals[$path]['bytes'], $originals[$path]['mode']); }
        catch (Throwable $ignored) { fwrite(STDERR, "RESPONSIVE_ROLLBACK_FAILED\n"); }
    }
    if ($qaDirectoryChanged) {
        try { if ($qaDirectoryMode === null) rmdir($qaDirectory); else chmod($qaDirectory, $qaDirectoryMode); }
        catch (Throwable $ignored) { fwrite(STDERR, "RESPONSIVE_ROLLBACK_FAILED\n"); }
    }
    fwrite(STDERR, 'RESPONSIVE_DEPLOY_FAILED: ' . $error->getMessage() . "\n"); exit(1);
} finally { if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); } }
