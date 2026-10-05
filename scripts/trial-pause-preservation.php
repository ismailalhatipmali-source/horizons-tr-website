<?php
declare(strict_types=1);

// Successor for the public /learn shell only. This never reads licence records.
const HZN_TRIAL_PAUSE_RELEASE = 'trial-pause-20261005-r1';
const HZN_TRIAL_PAUSE_PATHS = ['learn/index.html', 'learn/web-locales.json', 'learn/sw.js'];
const HZN_TRIAL_PAUSE_MANIFEST_SHA256 = '71d0284f58fb83bf37c8c127b42b04a85db323d3bf925bb133c36b54116d9979';

function hznTrialPausePath(string $root, string $relative): string {
    if (!preg_match('~^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$~D', $relative)) throw new RuntimeException('TRIAL_PAUSE_PATH_INVALID');
    $path = rtrim($root, '/');
    foreach (explode('/', $relative) as $part) {
        if ($part === '.' || $part === '..') throw new RuntimeException('TRIAL_PAUSE_PATH_INVALID');
        $path .= '/' . $part;
        if (is_link($path)) throw new RuntimeException('TRIAL_PAUSE_SYMLINK_REJECTED');
    }
    return $path;
}
function hznTrialPauseRead(string $path, int $limit = 1048576): string {
    if (is_link($path) || !is_file($path) || filesize($path) > $limit) throw new RuntimeException('TRIAL_PAUSE_FILE_INVALID');
    $raw = file_get_contents($path);
    if ($raw === false) throw new RuntimeException('TRIAL_PAUSE_READ_FAILED');
    return $raw;
}
function hznTrialPauseRelease(string $repo): array {
    $prefix = 'release-assets/' . HZN_TRIAL_PAUSE_RELEASE;
    $raw = hznTrialPauseRead(hznTrialPausePath($repo, $prefix . '/manifest.json'), 8192);
    if (!hash_equals(HZN_TRIAL_PAUSE_MANIFEST_SHA256, hash('sha256', $raw)) ||
        !hash_equals(HZN_TRIAL_PAUSE_MANIFEST_SHA256, trim(hznTrialPauseRead(hznTrialPausePath($repo, $prefix . '/manifest.sha256'), 128))))
        throw new RuntimeException('TRIAL_PAUSE_RELEASE_CHANGED');
    $release = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    if (($release['schema'] ?? 0) !== 1 || ($release['release'] ?? '') !== HZN_TRIAL_PAUSE_RELEASE ||
        array_keys($release['files'] ?? []) !== HZN_TRIAL_PAUSE_PATHS ||
        ($release['copy_source']['path'] ?? '') !== 'src/trial-pause/portal-copy.json')
        throw new RuntimeException('TRIAL_PAUSE_RELEASE_INVALID');
    $copyRaw = hznTrialPauseRead(hznTrialPausePath($repo, 'src/trial-pause/portal-copy.json'));
    if (!hash_equals($release['copy_source']['sha256'], hash('sha256', $copyRaw))) throw new RuntimeException('TRIAL_PAUSE_COPY_CHANGED');
    $copy = json_decode($copyRaw, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($copy) || count($copy) !== 32 || !isset($copy['ar'], $copy['en'])) throw new RuntimeException('TRIAL_PAUSE_LANGUAGES_INVALID');
    foreach ($copy as $entries) if (!is_array($entries) || array_keys($entries) !== ['accessTitle', 'trialNote', 'pilotFull']) throw new RuntimeException('TRIAL_PAUSE_COPY_INVALID');
    foreach (HZN_TRIAL_PAUSE_PATHS as $name) {
        $entry = $release['files'][$name];
        $source = $prefix . '/files/' . $name;
        if (($entry['source'] ?? '') !== $source || !preg_match('/^[a-f0-9]{64}$/D', $entry['before'] ?? '') ||
            !preg_match('/^[a-f0-9]{64}$/D', $entry['sha256'] ?? '') || !is_int($entry['bytes'] ?? null) ||
            $entry['bytes'] < 1 || $entry['bytes'] > 1048576) throw new RuntimeException('TRIAL_PAUSE_PAYLOAD_INVALID');
        $payload = hznTrialPauseRead(hznTrialPausePath($repo, $source));
        if (strlen($payload) !== $entry['bytes'] || !hash_equals($entry['sha256'], hash('sha256', $payload))) throw new RuntimeException('TRIAL_PAUSE_PAYLOAD_CHANGED');
    }
    return $release;
}
function hznTrialPauseState(string $web): ?array {
    $private = hznTrialPausePath(dirname($web), '.horizons-trial-pause');
    if (!file_exists($private)) return null;
    $receiptPath = hznTrialPausePath($private, 'receipt.json');
    if (!is_dir($private) || realpath($private) !== $private || (fileperms($private) & 0777) !== 0700 ||
        !is_file($receiptPath) || (fileperms($receiptPath) & 0777) !== 0600) throw new RuntimeException('TRIAL_PAUSE_RECEIPT_REQUIRED');
    $r = json_decode(hznTrialPauseRead($receiptPath, 8192), true, 16, JSON_THROW_ON_ERROR);
    $release = hznTrialPauseRelease(dirname(__DIR__));
    if (($r['schema'] ?? 0) !== 1 || ($r['release'] ?? '') !== HZN_TRIAL_PAUSE_RELEASE ||
        ($r['manifest_sha256'] ?? '') !== HZN_TRIAL_PAUSE_MANIFEST_SHA256 ||
        array_keys($r['before_hashes'] ?? []) !== HZN_TRIAL_PAUSE_PATHS ||
        array_keys($r['hashes'] ?? []) !== HZN_TRIAL_PAUSE_PATHS ||
        !preg_match('/^[a-f0-9]{64}$/D', $r['focus_receipt_sha256'] ?? '') ||
        !hash_equals($r['focus_receipt_sha256'], hash('sha256', hznTrialPauseRead(hznTrialPausePath(dirname($web), '.horizons-workbook-focus/receipt.json'), 262144))))
        throw new RuntimeException('TRIAL_PAUSE_RECEIPT_INVALID');
    foreach (HZN_TRIAL_PAUSE_PATHS as $name) {
        $entry = $release['files'][$name];
        $baseline = hznTrialPausePath($private, 'baseline/' . $name);
        $current = hznTrialPausePath($web, $name);
        if (($r['before_hashes'][$name] ?? '') !== $entry['before'] || ($r['hashes'][$name] ?? '') !== $entry['sha256'] ||
            (fileperms($baseline) & 0777) !== 0600 || (fileperms($current) & 0777) !== 0644 ||
            !hash_equals($entry['before'], hash('sha256', hznTrialPauseRead($baseline))) ||
            !hash_equals($entry['sha256'], hash('sha256', hznTrialPauseRead($current))))
            throw new RuntimeException('TRIAL_PAUSE_PUBLIC_CHANGED');
    }
    return ['baseline_root' => hznTrialPausePath($private, 'baseline'), 'hashes' => $r['hashes']];
}
