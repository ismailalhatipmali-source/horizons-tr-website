<?php
declare(strict_types=1);
require_once __DIR__ . '/native-ui-state.php';
function hznUiChain(string $web): array {
    require_once __DIR__ . '/trial-pause-preservation.php';
    require_once __DIR__ . '/workbook-focus-preservation.php';
    require_once __DIR__ . '/blending4-preservation.php';
    require_once __DIR__ . '/comprehensive-meaning-preservation.php';
    require_once __DIR__ . '/blending3-preservation.php';
    require_once __DIR__ . '/blending2-preservation.php';
    $trial = hznTrialPauseState($web); $focus = hznFocusState($web);
    if (!$trial || !$focus || !hznB4State($web) || !hznCMState($web) ||
        !hznB3State($web) || !hznBlending2SupersedingState($web)) hznUiFail('PREDECESSOR_CHAIN');
    return [$focus, $trial];
}
/* Private key is read only by the host CLI, never sent to a browser or included in
 * a plan, receipt, source repository, terminal response or plaintext staging file. */
function hznUiKey(string $web): string {
    $home = dirname($web); $pointer = hznUiPath($web, 'activation/config-path.php');
    hznUiRead($pointer, null, 65536);
    $level = ob_get_level(); ob_start();
    try { $configPath = require $pointer; }
    finally { while (ob_get_level() > $level) ob_end_clean(); }
    if (!is_string($configPath) || !str_starts_with($configPath, $home . '/') ||
        str_starts_with($configPath, $web . '/') || realpath($configPath) !== $configPath) hznUiFail('PRIVATE_CONFIG');
    hznUiRead($configPath, null, 262144);
    if ((fileperms($configPath) & 0022) !== 0) hznUiFail('CONFIG_PERMISSIONS');
    $level = ob_get_level(); ob_start();
    try { $config = require $configPath; }
    finally { while (ob_get_level() > $level) ob_end_clean(); }
    $vaultPath = $config['vault_path'] ?? null; unset($config);
    if (!is_string($vaultPath) || !str_starts_with($vaultPath, $home . '/') ||
        str_starts_with($vaultPath, $web . '/') || realpath($vaultPath) !== $vaultPath) hznUiFail('PRIVATE_VAULT');
    $raw = hznUiRead($vaultPath, 0600, 65536);
    $vault = json_decode($raw, true, 8, JSON_THROW_ON_ERROR); unset($raw);
    $key = base64_decode($vault['content_key'] ?? '', true);
    if (($vault['product'] ?? '') !== 'horizons-arabic-level1' || !is_string($key) || strlen($key) !== 32) hznUiFail('PRIVATE_VAULT');
    unset($vault); return $key;
}
/* Used after predecessor verification. Pure in-memory transformation apart from
 * reads of the fixed six files and two receipts. Tests supply synthetic valid keys.
 * No callback or command-line option skips the real predecessor checks in the CLI. */
function hznUiPrepare(string $web, array $release, array $focus, array $trial, string $key, ?array $installed = null): array {
    $before = hznUiSnapshot($web);
    if ($installed !== null) foreach (HZN_UI_PATHS as $p) {
        $raw = hznUiMatch(hznUiPath($installed['baseline_root'], $p), $installed['before'][$p], 0600);
        $before[$p] = ['bytes' => $raw, 'sha256' => hznUiHash($raw), 'mode' => 0644];
    } $inherited = hznUiInherited(dirname($web));
    foreach (HZN_UI_PATHS as $p) {
        $hash = $p === 'learn/sw.js' ? ($trial['hashes'][$p] ?? '') : ($focus['hashes'][$p] ?? '');
        if ($before[$p]['sha256'] !== $hash) hznUiFail('INSTALLED_BASELINE');
    }
    $oldPlain = hznUiDecrypt($before['learn/content/1.4.1/workbook.js.hzn']['bytes'], $key);
    $oldManifest = json_decode($before['learn/asset-manifest.json']['bytes'], true, 64, JSON_THROW_ON_ERROR);
    if (!hznUiSha($focus['plain_after_sha256'] ?? null) || hznUiHash($oldPlain) !== $focus['plain_after_sha256'] ||
        ($oldManifest['files']['workbook.js']['decoded_bytes'] ?? -1) !== strlen($oldPlain)) hznUiFail('PAID_BASELINE');
    $newPlain = hznUiAppend($oldPlain, $release['addon'], $focus['plain_after_sha256']);
    $demo = hznUiAppend($before['try/workbook.js']['bytes'], $release['addon'], $before['try/workbook.js']['sha256']);
    $paid = hznUiEncrypt($newPlain, $key);
    $after = [
        'try/workbook.js' => $demo,
        'learn/content/1.4.1/workbook.js.hzn' => $paid,
        'try/demo-asset-manifest.json' => hznUiManifest($before['try/demo-asset-manifest.json']['bytes'], $before['try/workbook.js']['bytes'], $demo, false),
        'learn/asset-manifest.json' => hznUiManifest($before['learn/asset-manifest.json']['bytes'], $before['learn/content/1.4.1/workbook.js.hzn']['bytes'], $paid, true, strlen($newPlain)),
        'try/sw.js' => hznUiWorker($before['try/sw.js']['bytes'], false, $release['worker_legacy'], $release['worker_single']),
        'learn/sw.js' => hznUiWorker($before['learn/sw.js']['bytes'], true, $release['worker_legacy'], $release['worker_single']),
    ];
    $metadata = ['manifest_sha256' => $release['manifest_sha256'], 'addon_sha256' => $release['addon_sha256'],
        'plain_before_sha256' => hznUiHash($oldPlain), 'plain_after_sha256' => hznUiHash($newPlain),
        'plain_before_bytes' => strlen($oldPlain), 'plain_after_bytes' => strlen($newPlain)];
    hznUiMetadata($metadata, $release);
    unset($oldPlain, $newPlain, $key);
    return ['before' => $before, 'after' => $after, 'inherited' => $inherited, 'metadata' => $metadata];
}
function hznUiVerifyPaid(string $web, array $state, array $release, string $key): void {
    $path = 'learn/content/1.4.1/workbook.js.hzn';
    $old = hznUiDecrypt(hznUiMatch(hznUiPath($state['baseline_root'], $path), $state['before'][$path], 0600), $key);
    $new = hznUiDecrypt(hznUiMatch(hznUiPath($web, $path), $state['after'][$path], 0644), $key);
    if (hznUiHash($old) !== $state['metadata']['plain_before_sha256'] || hznUiHash($new) !== $state['metadata']['plain_after_sha256'] ||
        $new !== hznUiAppend($old, $release['addon'], $state['metadata']['plain_before_sha256'])) hznUiFail('PAID_PRESERVATION');
    unset($key, $old, $new);
}

/* Upgrade only after both releases and the complete installed chain are checked.
 * Prepare new ciphertext in memory BEFORE restoring the old native baseline.
 * Each six-file transaction has durable recovery. If a normal failure occurs,
 * restore the exact previously installed UI. A crash between transactions leaves
 * the verified original single reader intact; the next publish can safely retry.
 */
function hznUiUpgrade(string $web, string $repo, array $installed, array $release,
    array $focus, array $trial, string $key, ?callable $checkpoint = null, ?callable $verifyChain = null): void {
    if (!$installed || $installed['journal_pending']) hznUiFail('RECOVERY_REQUIRED');
    if (hznUiState($web, $repo) !== $installed) hznUiFail('CONCURRENT_CHANGE');
    $oldRelease = hznUiRelease($repo, $installed['metadata']['manifest_sha256']);
    if (!$oldRelease['legacy'] || $release['legacy']) hznUiFail('UPGRADE_VERSION');
    hznUiVerifyPaid($web, $installed, $oldRelease, $key);
    $plan = hznUiPrepare($web, $release, $focus, $trial, $key, $installed);
    $previous = hznUiSnapshot($web);
    hznUiRollback($web);
    try {
        hznUiPublish($web, $plan['before'], $plan['after'], $plan['inherited'], $plan['metadata'],
            function () use ($web, $repo, $release, $key, $verifyChain): void {
                $state = hznUiState($web, $repo); if (!$state) hznUiFail('POST_VERIFY');
                hznUiVerifyPaid($web, $state, $release, $key);
                if ($verifyChain) $verifyChain();
            }, $checkpoint);
    } catch (Throwable $error) {
        // Never overwrite concurrent writes or an unfinished recovery journal.
        if (file_exists(hznUiPath(dirname($web), '.horizons-native-ui/pending.json'))) throw $error;
        $oldAfter = array_map(fn($row) => $row['bytes'], $previous);
        hznUiPublish($web, $plan['before'], $oldAfter, $installed['inherited'], $installed['metadata'],
            function () use ($web, $repo, $oldRelease, $key): void {
                $state = hznUiState($web, $repo); if (!$state) hznUiFail('POST_VERIFY');
                hznUiVerifyPaid($web, $state, $oldRelease, $key);
            });
        throw $error;
    }
}
