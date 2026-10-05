<?php
declare(strict_types=1);
// Scoped pause of automatic full-workbook trial messaging. Existing licences remain valid.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);
require_once __DIR__ . '/trial-pause-preservation.php';
require_once __DIR__ . '/workbook-focus-preservation.php';

function hznTrialPauseWrite(string $path, string $bytes, int $mode): void {
    $tmp = $path . '.trial-pause-' . bin2hex(random_bytes(6));
    try {
        if (file_put_contents($tmp, $bytes) !== strlen($bytes) || !chmod($tmp, $mode) || !rename($tmp, $path))
            throw new RuntimeException('TRIAL_PAUSE_WRITE_FAILED');
    } finally { if (is_file($tmp)) unlink($tmp); }
}
function hznTrialPauseProjection(array $before, array $after, array $copy): void {
    if (array_keys($before) !== array_keys($after) || array_keys($before) !== array_keys($copy)) throw new RuntimeException('TRIAL_PAUSE_LANGUAGE_CHANGED');
    foreach ($copy as $language => $fields) {
        if (array_keys($before[$language]) !== array_keys($after[$language])) throw new RuntimeException('TRIAL_PAUSE_FIELDS_CHANGED');
        $expected = $before[$language];
        foreach ($fields as $key => $value) $expected[$key] = $value;
        if ($expected !== $after[$language]) throw new RuntimeException('TRIAL_PAUSE_LOCALES_CHANGED');
    }
}
function hznTrialPauseVerifyChanges(array $old, array $new, array $copy): void {
    $oldLocales = json_decode($old['learn/web-locales.json'], true, 32, JSON_THROW_ON_ERROR);
    $newLocales = json_decode($new['learn/web-locales.json'], true, 32, JSON_THROW_ON_ERROR);
    hznTrialPauseProjection($oldLocales, $newLocales, $copy);
    $index = $old['learn/index.html'];
    foreach (['accessTitle'=>'h2', 'trialNote'=>'p'] as $key=>$tag) {
        $from = '<'.$tag.' data-w="'.$key.'">'.$oldLocales['ar'][$key].'</'.$tag.'>';
        $to = '<'.$tag.' data-w="'.$key.'">'.$copy['ar'][$key].'</'.$tag.'>';
        if (substr_count($index, $from) !== 1) throw new RuntimeException('TRIAL_PAUSE_HTML_BASELINE_CHANGED');
        $index = str_replace($from, $to, $index);
    }
    if ($index !== $new['learn/index.html']) throw new RuntimeException('TRIAL_PAUSE_HTML_CHANGED');
    $from = "const SHELL = 'hzn-web-shell-' + VERSION + '-" . HZN_FOCUS_PAID_SUFFIX . "';";
    $to = "const SHELL = 'hzn-web-shell-' + VERSION + '-" . HZN_FOCUS_PAID_SUFFIX . '-' . HZN_TRIAL_PAUSE_RELEASE . "';";
    if (substr_count($old['learn/sw.js'], $from) !== 1 || str_replace($from, $to, $old['learn/sw.js']) !== $new['learn/sw.js'])
        throw new RuntimeException('TRIAL_PAUSE_WORKER_CHANGED');
}

$private = ''; $locked = false; $lock = null; $created = false; $written = []; $failed = false; $restoreFailed = false;
try {
    if (count($argv) < 2 || count($argv) > 3 || (isset($argv[2]) && $argv[2] !== '--publish')) throw new RuntimeException('TRIAL_PAUSE_ARGUMENTS_INVALID');
    $input = rtrim($argv[1], '/'); $web = realpath($input); $repo = realpath(dirname(__DIR__));
    if (!$web || $web !== $input || $web === '/' || is_link($input) || !$repo ||
        str_starts_with($repo . '/', $web . '/') || str_starts_with($web . '/', $repo . '/')) throw new RuntimeException('TRIAL_PAUSE_ROOT_INVALID');
    $release = hznTrialPauseRelease($repo);
    if (hznTrialPauseState($web) !== null) { hznFocusState($web); echo "CURRENT: full-workbook trial paused; three shell files and prior receipts verified.\n"; exit(0); }
    if (hznFocusState($web) === null) throw new RuntimeException('TRIAL_PAUSE_FOCUS_REQUIRED');
    $copy = json_decode(hznTrialPauseRead(hznTrialPausePath($repo, $release['copy_source']['path'])), true, 16, JSON_THROW_ON_ERROR);
    $old = []; $new = [];
    foreach (HZN_TRIAL_PAUSE_PATHS as $name) {
        $target = hznTrialPausePath($web, $name); $entry = $release['files'][$name];
        $old[$name] = hznTrialPauseRead($target); $new[$name] = hznTrialPauseRead(hznTrialPausePath($repo, $entry['source']));
        if ((fileperms($target) & 0777) !== 0644 || !hash_equals($entry['before'], hash('sha256', $old[$name])))
            throw new RuntimeException('TRIAL_PAUSE_BASELINE_CHANGED');
    }
    hznTrialPauseVerifyChanges($old, $new, $copy);
    if (($argv[2] ?? '') !== '--publish') { echo "READY: automatic trial disabled separately; three /learn shell files verified; 32 languages; no files written.\n"; exit(0); }
    $home = dirname($web); $lockPath = hznTrialPausePath($home, '.horizons-trial-pause.lock');
    $lock = fopen($lockPath, 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB) || !chmod($lockPath, 0600)) throw new RuntimeException('TRIAL_PAUSE_DEPLOY_BUSY');
    $locked = true;
    $private = hznTrialPausePath($home, '.horizons-trial-pause');
    if (file_exists($private) || !mkdir($private, 0700) || !chmod($private, 0700)) throw new RuntimeException('TRIAL_PAUSE_PRIVATE_CONFLICT');
    $created = true;
    foreach (HZN_TRIAL_PAUSE_PATHS as $name) {
        $backup = hznTrialPausePath($private, 'baseline/' . $name);
        if (!is_dir(dirname($backup)) && !mkdir(dirname($backup), 0700, true)) throw new RuntimeException('TRIAL_PAUSE_BACKUP_FAILED');
        if (!chmod(dirname($backup), 0700)) throw new RuntimeException('TRIAL_PAUSE_BACKUP_FAILED');
        hznTrialPauseWrite($backup, $old[$name], 0600);
    }
    foreach (HZN_TRIAL_PAUSE_PATHS as $name) {
        $target = hznTrialPausePath($web, $name);
        if (hznTrialPauseRead($target) !== $old[$name] || (fileperms($target) & 0777) !== 0644)
            throw new RuntimeException('TRIAL_PAUSE_CONCURRENT_CHANGE');
        hznTrialPauseWrite($target, $new[$name], 0644); $written[] = $name;
    }
    $receipt = ['schema'=>1, 'release'=>HZN_TRIAL_PAUSE_RELEASE, 'manifest_sha256'=>HZN_TRIAL_PAUSE_MANIFEST_SHA256,
        'focus_receipt_sha256'=>hash('sha256', hznTrialPauseRead(hznTrialPausePath($home, '.horizons-workbook-focus/receipt.json'), 262144)),
        'before_hashes'=>array_map(fn($entry)=>$entry['before'], $release['files']),
        'hashes'=>array_map(fn($entry)=>$entry['sha256'], $release['files'])];
    hznTrialPauseWrite(hznTrialPausePath($private, 'receipt.json'), json_encode($receipt, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", 0600);
    hznTrialPauseState($web); hznFocusState($web);
    echo "PUBLISHED: automatic full-workbook trial offer removed in 32 languages; paid, invited and existing trial rights preserved.\n";
} catch (Throwable $error) {
    foreach (array_reverse($written) as $name) try {
        $target = hznTrialPausePath($web, $name);
        if (hznTrialPauseRead($target) !== $new[$name] || (fileperms($target) & 0777) !== 0644) throw new RuntimeException('TRIAL_PAUSE_ROLLBACK_CONFLICT');
        hznTrialPauseWrite($target, $old[$name], 0644);
    } catch (Throwable $ignored) { $restoreFailed = true; }
    if ($created && !$restoreFailed) {
        foreach (HZN_TRIAL_PAUSE_PATHS as $name) { $backup = hznTrialPausePath($private, 'baseline/'.$name); if (is_file($backup)) unlink($backup); }
        foreach (['baseline/learn','baseline'] as $dir) { $path = hznTrialPausePath($private, $dir); if (is_dir($path)) rmdir($path); }
        $receipt = hznTrialPausePath($private, 'receipt.json'); if (is_file($receipt)) unlink($receipt);
        if (is_dir($private)) rmdir($private);
    }
    $reason = $error instanceof RuntimeException && preg_match('/^[A-Z0-9_]+$/D', $error->getMessage()) ? $error->getMessage() : 'TRIAL_PAUSE_PUBLISH_FAILED';
    fwrite(STDERR, 'STOP: '.$reason.($restoreFailed ? '; RESTORE_REQUIRES_ATTENTION' : '; changes rolled back')."\n"); $failed = true;
} finally {
    if ($locked && is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
}
exit($failed ? 1 : 0);
