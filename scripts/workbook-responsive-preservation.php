<?php
declare(strict_types=1);
// Generic interface receipt. Original paid release receipts and audio stay intact.
const HZN_RESPONSIVE_RELEASE = 'workbook-responsive-20261004-r2';
const HZN_RESPONSIVE_WORKER_SUFFIX = 'blending3-20261004-r2-responsive-20261004-r2';
const HZN_RESPONSIVE_R1_SOURCES = [
    'src/workbook-web/responsive-workbook.css' => '6fc01aff760d42c7e39a752360bd2e2f4b4321f37cf619d9ac095c355a936b1e',
    'src/workbook-web/blending3-responsive.css' => '3717b3840e67c91a0502bccf50709bfd4c1dca8e5327eae0f3e86336bb7aa9f1',
    'src/workbook-web/blending3-component.js' => '0e448ccf639c62c9bb138c04ae62f69e760e8814796c03f16272cd9c28cc8f79',
    'src/workbook-web/layout-check.html' => 'e44db7f240474c0cace6c8d74f47535b8aee616bde3ee9af1286439ba3e462ef',
];
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
    $release = $receipt['patch'] ?? '';
    $suffixes = ['workbook-responsive-20261004-r1' => 'blending3-20261004-r2-responsive-20261004-r1', HZN_RESPONSIVE_RELEASE => HZN_RESPONSIVE_WORKER_SUFFIX];
    if (($receipt['schema'] ?? null) !== 1 || !isset($suffixes[$release])
        || ($receipt['worker_suffix'] ?? '') !== $suffixes[$release]
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
    if ($release === 'workbook-responsive-20261004-r1' && $receipt['sources'] !== HZN_RESPONSIVE_R1_SOURCES) {
        throw new RuntimeException('RESPONSIVE_R1_SOURCE_PINS_INVALID');
    }
    if ($release === HZN_RESPONSIVE_RELEASE) {
        $historyPath = hznB3Path($private, 'r1-receipt.json');
        $upgrade = $receipt['upgrade_from'] ?? null;
        if ($upgrade !== null || is_file($historyPath)) {
            if (!is_array($upgrade) || array_keys($upgrade) !== ['patch', 'receipt_sha256']
                || $upgrade['patch'] !== 'workbook-responsive-20261004-r1' || !is_file($historyPath)
                || filesize($historyPath) > 65536 || !preg_match('/^[a-f0-9]{64}$/D', $upgrade['receipt_sha256'])
                || !hash_equals($upgrade['receipt_sha256'], hash_file('sha256', $historyPath))) {
                throw new RuntimeException('RESPONSIVE_UPGRADE_LINEAGE_INVALID');
            }
            $previous = json_decode(hznB3Read($historyPath), true, 16, JSON_THROW_ON_ERROR);
            if (($previous['schema'] ?? null) !== 1 || ($previous['patch'] ?? '') !== $upgrade['patch']
                || ($previous['worker_suffix'] ?? '') !== $suffixes[$upgrade['patch']]
                || ($previous['original_blending3_receipt_sha256'] ?? '') !== $originalReceiptSha
                || ($previous['plain_before_sha256'] ?? '') !== $original['plain_workbook_sha256']
                || ($previous['sources'] ?? []) !== HZN_RESPONSIVE_R1_SOURCES
                || array_keys($previous['hashes'] ?? []) !== $shared
                || !preg_match('/^[a-f0-9]{64}$/D', $previous['plain_after_sha256'] ?? '')) {
                throw new RuntimeException('RESPONSIVE_UPGRADE_LINEAGE_INVALID');
            }
            $history = ['asset-manifest.json' => 'r1-manifest.json', 'sw.js' => 'r1-sw.js', 'content/1.4.1/workbook.js.hzn' => 'r1-workbook.hzn'];
            foreach ($history as $relative => $name) {
                $file = hznB3Path($private, $name);
                if (!is_file($file) || !preg_match('/^[a-f0-9]{64}$/D', $previous['hashes'][$relative])
                    || !hash_equals($previous['hashes'][$relative], hash_file('sha256', $file))) {
                    throw new RuntimeException('RESPONSIVE_UPGRADE_HISTORY_CHANGED');
                }
            }
            $historyQa = hznB3Path($private, 'r1-qa.html');
            if (($previous['public_qa'] ?? []) !== ['relative' => 'layout-check/index.html', 'sha256' => HZN_RESPONSIVE_R1_SOURCES['src/workbook-web/layout-check.html']]
                || !is_file($historyQa) || !hash_equals(HZN_RESPONSIVE_R1_SOURCES['src/workbook-web/layout-check.html'], hash_file('sha256', $historyQa))) {
                throw new RuntimeException('RESPONSIVE_UPGRADE_HISTORY_CHANGED');
            }
        }
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
    $new = "const SHELL = 'hzn-web-shell-' + VERSION + '-" . $receipt['worker_suffix'] . "';";
    $beforeWorker = hznB3Read(hznB3Path($private, 'baseline-sw.js'));
    if (substr_count($beforeWorker, $old) !== 1 || str_replace($old, $new, $beforeWorker) !== hznB3Read(hznB3Path($learn, 'sw.js'))) {
        throw new RuntimeException('RESPONSIVE_WORKER_CHANGED');
    }
    return $receipt;
}
