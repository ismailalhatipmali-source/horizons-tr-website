<?php
declare(strict_types=1);
// Generic interface receipt. Original paid release receipts and audio stay intact.
const HZN_RESPONSIVE_RELEASE = 'workbook-responsive-20261004-r1';
const HZN_RESPONSIVE_WORKER_SUFFIX = 'blending3-20261004-r2-responsive-20261004-r1';
function hznResponsiveJson(array $value): string {
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}
function hznResponsiveState(string $web, array $original, string $originalReceiptSha): ?array {
    $home = dirname($web);
    $private = hznB3Path($home, '.horizons-workbook-responsive');
    $path = hznB3Path($private, 'receipt.json');
    if (!is_file($path)) return null;
    if (realpath($path) !== $path || str_starts_with($path, $web . '/') || filesize($path) > 65536) {
        throw new RuntimeException('RESPONSIVE_PRIVATE_RECEIPT_REQUIRED');
    }
    $receipt = json_decode(hznB3Read($path), true, 16, JSON_THROW_ON_ERROR);
    $shared = ['asset-manifest.json', 'sw.js', 'content/1.4.1/workbook.js.hzn'];
    $sources = ['src/workbook-web/responsive-workbook.css', 'src/workbook-web/blending3-responsive.css', 'src/workbook-web/blending3-component.js', 'src/workbook-web/layout-check.html'];
    if (($receipt['schema'] ?? null) !== 1 || ($receipt['patch'] ?? '') !== HZN_RESPONSIVE_RELEASE
        || ($receipt['worker_suffix'] ?? '') !== HZN_RESPONSIVE_WORKER_SUFFIX
        || ($receipt['original_blending3_receipt_sha256'] ?? '') !== $originalReceiptSha
        || ($receipt['plain_before_sha256'] ?? '') !== $original['plain_workbook_sha256']
        || array_keys($receipt['hashes'] ?? []) !== $shared
        || array_keys($receipt['sources'] ?? []) !== $sources
        || !preg_match('/^[a-f0-9]{64}$/D', $receipt['plain_after_sha256'] ?? '')) {
        throw new RuntimeException('RESPONSIVE_RECEIPT_INVALID');
    }
    foreach ($receipt['sources'] as $sha) {
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha)) throw new RuntimeException('RESPONSIVE_SOURCE_PINS_INVALID');
    }
    $learn = hznB3Path($web, 'learn');
    $qa = $receipt['public_qa'] ?? [];
    $qaPath = hznB3Path($learn, 'layout-check/index.html');
    $qaEntries = is_dir(dirname($qaPath)) ? scandir(dirname($qaPath)) : false;
    if (array_keys($qa) !== ['relative', 'sha256'] || $qa['relative'] !== 'layout-check/index.html'
        || $qa['sha256'] !== $receipt['sources']['src/workbook-web/layout-check.html']
        || $qaEntries === false || array_values(array_diff($qaEntries, ['.', '..'])) !== ['index.html']
        || !is_file($qaPath) || !hash_equals($qa['sha256'], hash_file('sha256', $qaPath))) {
        throw new RuntimeException('RESPONSIVE_QA_FIXTURE_CHANGED');
    }
    $backups = ['asset-manifest.json' => 'baseline-manifest.json', 'sw.js' => 'baseline-sw.js', 'content/1.4.1/workbook.js.hzn' => 'baseline-workbook.hzn'];
    foreach ($shared as $relative) {
        $sha = $receipt['hashes'][$relative];
        $current = hznB3Path($learn, $relative);
        $before = hznB3Path($private, $backups[$relative]);
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha) || !is_file($current) || !hash_equals($sha, hash_file('sha256', $current))
            || !is_file($before) || !hash_equals($original['hashes'][$relative], hash_file('sha256', $before))) {
            throw new RuntimeException('RESPONSIVE_ASSET_CHANGED');
        }
    }
    $baselineRaw = hznB3Read(hznB3Path($private, 'baseline-manifest.json'));
    if (strlen($baselineRaw) > 4194304) throw new RuntimeException('RESPONSIVE_BASELINE_INVALID');
    $baseline = json_decode($baselineRaw, true, 32, JSON_THROW_ON_ERROR);
    $manifest = json_decode(hznB3Read(hznB3Path($learn, 'asset-manifest.json')), true, 32, JSON_THROW_ON_ERROR);
    $projected = $manifest;
    $projected['files']['workbook.js'] = $baseline['files']['workbook.js'];
    if (hznResponsiveJson($projected) !== hznResponsiveJson($baseline)) {
        throw new RuntimeException('RESPONSIVE_PREVIOUS_CONTENT_CHANGED');
    }
    $old = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2';";
    $new = "const SHELL = 'hzn-web-shell-' + VERSION + '-" . HZN_RESPONSIVE_WORKER_SUFFIX . "';";
    $beforeWorker = hznB3Read(hznB3Path($private, 'baseline-sw.js'));
    if (substr_count($beforeWorker, $old) !== 1 || str_replace($old, $new, $beforeWorker) !== hznB3Read(hznB3Path($learn, 'sw.js'))) {
        throw new RuntimeException('RESPONSIVE_WORKER_CHANGED');
    }
    return $receipt;
}
