<?php
declare(strict_types=1);
// Read-only validation used by older deployers before retaining a newer layer.
// A recognizable cache suffix alone is never permission to bypass a baseline.
function hznBlending2Path(string $root, string $relative): string {
    if ($relative === '' || preg_match('/[\\\\\x00-\x1f?#]/', $relative)) throw new RuntimeException('SUPERSEDING_PATH_INVALID');
    $path = $root;
    foreach (explode('/', $relative) as $part) {
        if ($part === '' || $part === '.' || $part === '..') throw new RuntimeException('SUPERSEDING_PATH_INVALID');
        $path .= '/' . $part;
        if (is_link($path)) throw new RuntimeException('SYMLINK_REJECTED');
    }
    return $path;
}
function hznBlending2SupersedingState(string $web): ?array {
    // A later localizer may update only the encrypted player and cache suffix.
    // Validate that private receipt before accepting its inherited audio pins.
    $meaningBridge = __DIR__ . '/meaning-preservation.php';
    $meaningState = null;
    if (is_file($meaningBridge)) {
        require_once $meaningBridge;
        $meaningState = hznMeaningSupersedingState($web);
    } elseif (is_file(dirname($web) . '/.horizons-meaning/receipt.json')) throw new RuntimeException('MEANING_BRIDGE_REQUIRED');
    $home = dirname($web); $state = hznBlending2Path($home, '.horizons-blending2');
    $receiptPath = hznBlending2Path($state, 'receipt.json');
    if (!is_file($receiptPath)) return null;
    $real = realpath($receiptPath);
    if (!$real || dirname($real) !== $state || !str_starts_with($real, $home . '/') || str_starts_with($real, $web . '/') || filesize($real) > 262144) throw new RuntimeException('PRIVATE_RECEIPT_REQUIRED');
    $receipt = $meaningState['receipt'] ?? json_decode(file_get_contents($real), true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($receipt) || ($receipt['schema'] ?? null) !== 1 || ($receipt['patch'] ?? '') !== 'blending2-20261003' || ($receipt['closed_count'] ?? null) !== 250 || ($receipt['open_count'] ?? null) !== 81 || !preg_match('/^[a-f0-9]{64}$/D', $receipt['release_sha256'] ?? '') || !is_array($receipt['hashes'] ?? null) || count($receipt['hashes']) !== 253) throw new RuntimeException('SUPERSEDING_RECEIPT_INVALID');
    $learn = hznBlending2Path($web, 'learn');
    foreach (['asset-manifest.json', 'sw.js'] as $name) {
        $sha = $receipt['hashes'][$name] ?? '';
        $path = hznBlending2Path($learn, $name);
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha) || !is_file($path) || !hash_equals($sha, hash_file('sha256', $path))) throw new RuntimeException('SUPERSEDING_SHARED_FILE_CHANGED');
    }
    $manifest = json_decode(file_get_contents(hznBlending2Path($learn, 'asset-manifest.json')), true, 32, JSON_THROW_ON_ERROR);
    if (($manifest['product'] ?? '') !== 'horizons-arabic-level1' || ($manifest['version'] ?? '') !== '1.4.6' || ($manifest['content_versions'] ?? []) !== ['1.4.0', '1.4.1'] || ($manifest['phonics_release'] ?? '') !== 'phonics-20261003' || ($manifest['phonics_visual_release'] ?? '') !== 'phonics-glyphs-20261003-r2' || ($manifest['blending2_release'] ?? '') !== 'blending2-20261003' || ($manifest['blending2_closed_count'] ?? null) !== 250 || ($manifest['blending2_open_count'] ?? null) !== 81) throw new RuntimeException('SUPERSEDING_MANIFEST_INVALID');
    $worker = file_get_contents(hznBlending2Path($learn, 'sw.js'));
    $suffix = isset($meaningState['blending3_receipt']) ? $meaningState['worker_suffix'] : ($meaningState === null ? 'blending2-20261003' : 'meanings-20261003-r1');
    if (substr_count($worker, "const SHELL = 'hzn-web-shell-' + VERSION + '-" . $suffix . "';") !== 1) throw new RuntimeException('SUPERSEDING_WORKER_INVALID');
    $closed = []; $opened = [];
    foreach ($manifest['groups']['blending2'] ?? [] as $path) {
        if (preg_match('~^course/audio/blending2/blend2\.closed\.[a-z_]+\.(?:fatha|damma|kasra)\.[a-z_]+\.mp3$~D', $path)) $closed[] = $path;
        elseif (preg_match('~^course/audio/phonics/phonics\.[a-z_]+\.(?:fatha|damma|kasra)\.long\.mp3$~D', $path)) $opened[] = $path;
        elseif ($path !== 'workbook.js') throw new RuntimeException('SUPERSEDING_GROUP_INVALID');
    }
    if (count($closed) !== 250 || count(array_unique($closed)) !== 250 || count($opened) !== 81 || count(array_unique($opened)) !== 81 || count($manifest['groups']['blending2'] ?? []) !== 332 || !in_array('workbook.js', $manifest['groups']['blending2'], true)) throw new RuntimeException('SUPERSEDING_GROUP_INVALID');
    $expectedReceiptKeys = ['asset-manifest.json', 'sw.js'];
    foreach (array_merge($closed, ['workbook.js']) as $path) {
        $entry = $manifest['files'][$path] ?? [];
        $url = 'content/1.4.1/' . $path . '.hzn';
        $sha = $receipt['hashes'][$url] ?? '';
        $file = hznBlending2Path($learn, $url);
        if (($entry['url'] ?? '') !== $url || ($entry['sha256'] ?? '') !== $sha || !preg_match('/^[a-f0-9]{64}$/D', $sha) || !is_file($file) || filesize($file) !== ($entry['bytes'] ?? -1) || !hash_equals($sha, hash_file('sha256', $file)) || !in_array($path, $manifest['groups']['all'] ?? [], true)) throw new RuntimeException('SUPERSEDING_ASSET_DAMAGED');
        $expectedReceiptKeys[] = $url;
    }
    $actualReceiptKeys = array_keys($receipt['hashes']); sort($actualReceiptKeys); sort($expectedReceiptKeys);
    if ($actualReceiptKeys !== $expectedReceiptKeys) throw new RuntimeException('SUPERSEDING_RECEIPT_INVALID');
    foreach ($opened as $path) {
        $entry = $manifest['files'][$path] ?? [];
        $url = 'content/1.4.1/' . $path . '.hzn';
        $file = hznBlending2Path($learn, $url);
        $sha = $entry['sha256'] ?? '';
        if (($entry['url'] ?? '') !== $url || ($entry['mime'] ?? '') !== 'audio/mpeg' || !preg_match('/^[a-f0-9]{64}$/D', $sha) || !is_file($file) || filesize($file) !== ($entry['bytes'] ?? -1) || !hash_equals($sha, hash_file('sha256', $file)) || !in_array($path, $manifest['groups']['phonics'] ?? [], true)) throw new RuntimeException('SUPERSEDING_REUSE_INVALID');
    }
    return ['manifest' => $manifest, 'receipt' => $receipt];
}
