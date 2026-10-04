<?php
declare(strict_types=1);
// This receipt contains hashes only. Paid explanations stay in the private
// upload package and in the existing encrypted application.
function hznMeaningPath(string $root, string $relative): string {
    $path = $root;
    foreach (explode('/', $relative) as $part) {
        if ($part === '' || $part === '.' || $part === '..' || preg_match('/[\\\\\x00-\x1f?#]/', $part)) throw new RuntimeException('MEANING_PATH_INVALID');
        $path .= '/' . $part;
        if (is_link($path)) throw new RuntimeException('SYMLINK_REJECTED');
    }
    return $path;
}
function hznMeaningBaselineFingerprint(array $manifest): string {
    unset($manifest['files']['workbook.js'], $manifest['meaning_release'], $manifest['meaning_languages']);
    return hash('sha256', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
}
function hznMeaningSupersedingState(string $web): ?array {
    $b3Bridge=__DIR__.'/blending3-preservation.php';$b3=null;
    if(is_file($b3Bridge)){require_once $b3Bridge;$b3=hznB3State($web);}elseif(is_file(dirname($web).'/.horizons-blending3/receipt.json'))throw new RuntimeException('BLENDING3_BRIDGE_REQUIRED');
    $home = dirname($web);
    $path = hznMeaningPath($home, '.horizons-meaning/receipt.json');
    if (!is_file($path)) return null;
    if (!($real = realpath($path)) || $real !== $path || str_starts_with($real, $web . '/') || filesize($path) > 262144) throw new RuntimeException('PRIVATE_MEANING_RECEIPT_REQUIRED');
    $receipt = json_decode(file_get_contents($path), true, 24, JSON_THROW_ON_ERROR);
    if (($receipt['schema'] ?? null) !== 1 || ($receipt['patch'] ?? '') !== 'meanings-20261003-r1' || ($receipt['baseline_manifest_sha256'] ?? '') !== 'b1b0b609b794552086849d3cd07c85a5bfd8894ab78223be39a5fc395d8dd9e7' || count($receipt['language_codes'] ?? []) !== 32 || count(array_unique($receipt['language_codes'] ?? [])) !== 32 || !preg_match('/^[a-f0-9]{64}$/D', $receipt['release_sha256'] ?? '') || !preg_match('/^[a-f0-9]{64}$/D', $receipt['unchanged_manifest_fingerprint'] ?? '') || count($receipt['hashes'] ?? []) !== 3) throw new RuntimeException('MEANING_RECEIPT_INVALID');
    if($b3!==null)foreach(['asset-manifest.json','sw.js','content/1.4.1/workbook.js.hzn'] as $p)$receipt['hashes'][$p]=$b3['receipt']['hashes'][$p];
    $learn = hznMeaningPath($web, 'learn');
    $keys = ['asset-manifest.json', 'sw.js', 'content/1.4.1/workbook.js.hzn'];
    $actual = array_keys($receipt['hashes']); sort($actual); $expected = $keys; sort($expected);
    if ($actual !== $expected) throw new RuntimeException('MEANING_RECEIPT_INVALID');
    foreach ($keys as $relative) {
        $sha = $receipt['hashes'][$relative]; $file = hznMeaningPath($learn, $relative);
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha) || !is_file($file) || !hash_equals($sha, hash_file('sha256', $file))) throw new RuntimeException('MEANING_SHARED_FILE_CHANGED');
    }
    $manifest = json_decode(file_get_contents(hznMeaningPath($learn, 'asset-manifest.json')), true, 32, JSON_THROW_ON_ERROR);
    if (($manifest['meaning_release'] ?? '') !== $receipt['patch'] || ($manifest['meaning_languages'] ?? []) !== $receipt['language_codes'] || !hash_equals($receipt['unchanged_manifest_fingerprint'], hznMeaningBaselineFingerprint($b3['baseline']??$manifest))) throw new RuntimeException('MEANING_BASELINE_CONTENT_CHANGED');
    $worker = file_get_contents(hznMeaningPath($learn, 'sw.js'));
    $suffix=$b3===null?'meanings-20261003-r1':'blending3-20261004-r2';
    if (substr_count($worker, "const SHELL = 'hzn-web-shell-' + VERSION + '-".$suffix."';") !== 1) throw new RuntimeException('MEANING_WORKER_INVALID');
    $entry = $manifest['files']['workbook.js'] ?? [];
    if (($entry['url'] ?? '') !== 'content/1.4.1/workbook.js.hzn' || ($entry['sha256'] ?? '') !== $receipt['hashes'][$entry['url']] || filesize(hznMeaningPath($learn, $entry['url'])) !== ($entry['bytes'] ?? -1)) throw new RuntimeException('MEANING_APPLICATION_DAMAGED');
    $api = $receipt['learning_api'] ?? [];
    $apiPath = hznMeaningPath($web, 'learning-api/Core.php');
    if (($api['relative'] ?? '') !== 'learning-api/Core.php' || !preg_match('/^[a-f0-9]{64}$/D', $api['sha256'] ?? '') || !is_file($apiPath) || !hash_equals($api['sha256'], hash_file('sha256', $apiPath))) throw new RuntimeException('MEANING_LEARNING_API_CHANGED');
    $inherited = $receipt['inherited_blending2_receipt'] ?? null;
    if (!is_array($inherited) || count($inherited['hashes'] ?? []) !== 253) throw new RuntimeException('MEANING_BASELINE_RECEIPT_REQUIRED');
    foreach ($receipt['hashes'] as $relative => $sha) $inherited['hashes'][$relative] = $sha;
    return ['manifest' => $manifest, 'receipt' => $inherited, 'meaning_receipt' => $receipt, 'blending3_receipt'=>$b3['receipt']??null];
}

