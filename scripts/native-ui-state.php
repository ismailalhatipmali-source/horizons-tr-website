<?php
declare(strict_types=1);
require_once __DIR__ . '/native-ui-publication.php';
const HZN_UI_CODE = ['scripts/native-ui-publication.php', 'scripts/native-ui-state.php',
    'scripts/native-ui-plan.php', 'scripts/deploy-native-ui.php',
    'scripts/workbook-focus-preservation.php', 'scripts/trial-pause-preservation.php',
    'scripts/comprehensive-meaning-preservation.php',
    'scripts/blending3-preservation.php', 'scripts/meaning-preservation.php', 'scripts/blending2-preservation.php',
    'release-assets/native-experiences-20261007-r1/predecessors/comprehensive-meaning-preservation.php'];
/* Validate checked-in sources every time. Never interpret a receipt as a permission
 * to skip the release hash, fixed path set, historical receipts or private backups. */
function hznUiRelease(string $repo): array {
    hznUiRoot($repo);
    $base = hznUiPath($repo, 'release-assets/' . HZN_UI_RELEASE);
    $raw = hznUiRead($base . '/manifest.json', null, 32768);
    $pin = trim(hznUiRead($base . '/manifest.sha256', null, 128));
    if (!hznUiSha($pin) || !hash_equals($pin, hznUiHash($raw))) hznUiFail('RELEASE_HASH');
    $r = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (($r['schema'] ?? null) !== 1 || ($r['release'] ?? '') !== HZN_UI_RELEASE ||
        ($r['paths'] ?? []) !== HZN_UI_PATHS || array_keys($r['sources'] ?? []) !== HZN_UI_SOURCES ||
        array_keys($r['code'] ?? []) !== HZN_UI_CODE || !hznUiSha($r['addon_sha256'] ?? null)) hznUiFail('RELEASE');
    foreach ($r['code'] as $p => $sha) {
        if (!hznUiSha($sha) || hznUiHash(hznUiRead(hznUiPath($repo, $p), null, 1048576)) !== $sha) hznUiFail('RELEASE_CODE');
    }
    $addon = hznUiAddon($repo, $r['sources']);
    if (!hash_equals($r['addon_sha256'], hznUiHash($addon))) hznUiFail('ADDON_HASH');
    $r['manifest_sha256'] = $pin; $r['addon'] = $addon; return $r;
}
function hznUiMetadata(array $m, array $release): void {
    if (array_keys($m) !== ['manifest_sha256', 'addon_sha256', 'plain_before_sha256', 'plain_after_sha256',
        'plain_before_bytes', 'plain_after_bytes']) hznUiFail('METADATA');
    foreach (array_slice(array_keys($m), 0, 4) as $k) if (!hznUiSha($m[$k])) hznUiFail('METADATA');
    if ($m['manifest_sha256'] !== $release['manifest_sha256'] || $m['addon_sha256'] !== $release['addon_sha256'] ||
        !is_int($m['plain_before_bytes']) || !is_int($m['plain_after_bytes']) ||
        $m['plain_before_bytes'] < 1 || $m['plain_after_bytes'] > 33554432 ||
        $m['plain_after_bytes'] !== $m['plain_before_bytes'] + strlen($release['addon'])) hznUiFail('METADATA');
}
/* No calls into predecessor state functions: they call this function, so the
 * chain cannot recurse. The original predecessor validators still run afterward.
 * Only the six updated paths may be resolved to the private pre-UI baseline. */
function hznUiState(string $web, ?string $repo = null): ?array {
    $home = dirname(hznUiRoot($web)); $private = hznUiPath($home, '.horizons-native-ui');
    if (!file_exists($private)) return null;
    hznUiRoot($private);
    if ((fileperms($private) & 0777) !== 0700) hznUiFail('PRIVATE_DIRECTORY');
    $active = hznUiPath($private, 'receipt.json'); $pending = hznUiPath($private, 'pending.json');
    if (!file_exists($active)) {
        if (file_exists($pending)) hznUiFail('RECOVERY_REQUIRED');
        return null;
    }
    $raw = hznUiRead($active, 0600, 262144); $r = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (array_keys($r) !== ['schema', 'release', 'transaction', 'before', 'after', 'inherited', 'metadata'] ||
        $r['schema'] !== 1 || $r['release'] !== HZN_UI_RELEASE || !preg_match('/^[a-f0-9]{24}$/D', $r['transaction'])) hznUiFail('RECEIPT');
    hznUiFixed($r['before']); hznUiFixed($r['after']); hznUiCheckInherited($home, $r['inherited']);
    if (file_exists($pending) && hznUiRead($pending, 0600, 262144) !== $raw) hznUiFail('JOURNAL_CONFLICT');
    $release = hznUiRelease($repo ?? dirname(__DIR__)); hznUiMetadata($r['metadata'], $release);
    $txn = hznUiPath($private, 'tx-' . $r['transaction']); $base = hznUiPath($txn, 'before');
    foreach ([$txn, $base] as $d) if (!is_dir($d) || (fileperms($d) & 0777) !== 0700) hznUiFail('PRIVATE_DIRECTORY');
    $old = []; $now = [];
    foreach (HZN_UI_PATHS as $p) {
        $old[$p] = hznUiMatch(hznUiPath($base, $p), $r['before'][$p], 0600);
        $now[$p] = hznUiMatch(hznUiPath($web, $p), $r['after'][$p], 0644);
    }
    // Bind the saved baseline to immutable focus/trial receipts, not to arbitrary input.
    $focus = json_decode(hznUiRead(hznUiPath($home, HZN_UI_RECEIPTS[0]), 0600, 262144), true, 32, JSON_THROW_ON_ERROR);
    $trial = json_decode(hznUiRead(hznUiPath($home, HZN_UI_RECEIPTS[1]), 0600, 262144), true, 32, JSON_THROW_ON_ERROR);
    if (($focus['release'] ?? '') !== 'workbook-focus-20261005-r1' || ($trial['release'] ?? '') !== 'trial-pause-20261005-r1' ||
        ($trial['focus_receipt_sha256'] ?? '') !== $r['inherited'][HZN_UI_RECEIPTS[0]] ||
        ($focus['plain_after_sha256'] ?? '') !== $r['metadata']['plain_before_sha256']) hznUiFail('LINEAGE');
    foreach (HZN_UI_PATHS as $p) {
        $expected = $p === 'learn/sw.js' ? ($trial['hashes'][$p] ?? '') : ($focus['hashes'][$p] ?? '');
        if (!hznUiSha($expected) || $r['before'][$p] !== $expected) hznUiFail('LINEAGE');
    }
    if (hznUiAppend($old['try/workbook.js'], $release['addon'], $r['before']['try/workbook.js']) !== $now['try/workbook.js']) hznUiFail('DEMO_PRESERVATION');
    foreach (['try' => false, 'learn' => true] as $edition => $paid) {
        $mp = $edition . ($paid ? '/asset-manifest.json' : '/demo-asset-manifest.json');
        $app = $paid ? 'learn/content/1.4.1/workbook.js.hzn' : 'try/workbook.js';
        $expected = hznUiManifest($old[$mp], $old[$app], $now[$app], $paid, $paid ? $r['metadata']['plain_after_bytes'] : null);
        if ($expected !== $now[$mp]) hznUiFail('CONTENT_PRESERVATION');
        if (hznUiWorker($old[$edition . '/sw.js'], $paid) !== $now[$edition . '/sw.js']) hznUiFail('WORKER_PRESERVATION');
    }
    $priorPaid = json_decode($old['learn/asset-manifest.json'], true, 64, JSON_THROW_ON_ERROR);
    if (($priorPaid['files']['workbook.js']['decoded_bytes'] ?? -1) !== $r['metadata']['plain_before_bytes']) hznUiFail('DECODED_LENGTH');
    $r['baseline_root'] = $base; $r['journal_pending'] = file_exists($pending); return $r;
}
function hznUiPreviousPath(string $web, string $relative, ?array $state): string {
    return hznUiPath($state !== null && in_array($relative, HZN_UI_PATHS, true) ? $state['baseline_root'] : $web, $relative);
}
function hznUiPreviousMode(string $relative, ?array $state): int {
    return $state !== null && in_array($relative, HZN_UI_PATHS, true) ? 0600 : 0644;
}
