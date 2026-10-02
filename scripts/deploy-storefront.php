<?php
declare(strict_types=1);
// Publish the changed storefront after the independently installed workbook.
// Never rebuild immutable audio/images or touch host configuration and databases.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);
$written = []; $temporary = []; $locked = false; $lock = ''; $backup = '';
function safePath(string $root, string $path): string {
    if (!preg_match('~^[A-Za-z0-9][A-Za-z0-9_./-]*$~D', $path)
        || str_contains('/'.$path.'/', '/../') || str_contains('/'.$path.'/', '/./')
        || str_contains($path, '//') || str_ends_with($path, '/')) throw new RuntimeException('INVALID_PATH');
    $current = $root;
    foreach (explode('/', $path) as $part) {
        $current .= '/'.$part;
        if (is_link($current)) throw new RuntimeException('SYMLINK_REJECTED');
    }
    if (file_exists($current) && !is_file($current)) throw new RuntimeException('FILE_CONFLICT');
    return $current;
}
function digest(string $path): ?string { return is_file($path) ? hash_file('sha256', $path) : null; }
try {
    $repo = realpath(dirname(__DIR__)); $input = $argv[1] ?? '';
    if (is_link($input) || !($web = realpath($input)) || !is_dir($web)
        || str_starts_with($repo.'/', $web.'/') || str_starts_with($web.'/', $repo.'/')) throw new RuntimeException('INVALID_ROOT');
    $state = dirname($web).'/.horizons-deploy-'.basename($web);
    if (is_link($state)) throw new RuntimeException('SYMLINK_REJECTED');
    if (!is_dir($state) && !mkdir($state, 0700)) throw new RuntimeException('STATE_FAILED');
    $lock = $state.'/deploy.lock';
    if (!@mkdir($lock, 0700)) throw new RuntimeException('DEPLOYMENT_ALREADY_RUNNING');
    $locked = true;
    $manifest = json_decode(file_get_contents($repo.'/release-assets/1.4.4/storefront-manifest.json'), true, 16, JSON_THROW_ON_ERROR);
    if (($manifest['version'] ?? '') !== '1.4.4' || empty($manifest['files']) || count($manifest['files']) > 1500) throw new RuntimeException('INVALID_MANIFEST');
    foreach ($manifest['requires'] as $path => $sha) {
        if (!hash_equals($sha, digest(safePath($web, $path)) ?? '')) throw new RuntimeException('WORKBOOK_UPDATE_REQUIRED');
    }
    $changes = []; $total = 0;
    foreach ($manifest['files'] as $path => $entry) {
        // Only localized storefront documents and the checkout's own assets.
        if (!preg_match('~^(?:[a-z]{2}/[a-z-]+\.html|assets/commerce-geo/(?:[A-Za-z-]+\.json|LICENSE\.txt|README\.txt)|(?:cart|checkout)\.html|(?:home|commerce|commerce-cart|site-commerce|location-picker)\.(?:css|js))$~D', $path)) throw new RuntimeException('UNAPPROVED_PATH');
        $source = safePath($repo.'/dist', $path); $target = safePath($web, $path);
        if (!is_int($entry['bytes']) || $entry['bytes'] < 1 || $entry['bytes'] > 2097152
            || !is_file($source) || filesize($source) !== $entry['bytes']
            || !hash_equals($entry['sha256'], digest($source) ?? '')) throw new RuntimeException('SOURCE_CHECKSUM_FAILED');
        $total += $entry['bytes']; if ($total > 20971520) throw new RuntimeException('PAYLOAD_TOO_LARGE');
        $current = digest($target);
        if ($current === $entry['sha256']) continue;
        $baseline = $entry['before'];
        if (is_string($baseline) && str_starts_with($baseline, 'git-sha1:') && $current !== null) {
            // Compare to the exact Git blob from the last published commit.
            $bytes = file_get_contents($target);
            $matches = hash_equals(substr($baseline, 9), sha1('blob '.strlen($bytes)."\0".$bytes));
        } else { $matches = $current === $baseline; }
        if (!$matches) throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
        $changes[$path] = [$source, $target, $current];
    }
    if (($argv[2] ?? '') === '--publish') {
        // This directory contains only the public country/city dataset. Repair
        // the restrictive umask used by the first publication of these assets.
        $geo = $web.'/assets/commerce-geo';
        if (is_dir($geo) && !is_link($geo) && !chmod($geo, 0755)) throw new RuntimeException('DIRECTORY_FAILED');
    }
    if (($argv[2] ?? '') !== '--publish') { echo 'READY: '.count($changes)." changed storefront files; workbook and public baselines verified.\n"; }
    elseif (!$changes) { echo "CURRENT: storefront already published.\n"; }
    else {
        $backup = $state.'/storefront-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
        if (!mkdir($backup, 0700)) throw new RuntimeException('BACKUP_FAILED');
        foreach ($changes as $path => [$source, $target, $prior]) {
            $save = $backup.'/'.$path;
            if (!is_dir(dirname($save)) && !mkdir(dirname($save), 0700, true)) throw new RuntimeException('BACKUP_FAILED');
            if ($prior !== null && (!copy($target, $save) || digest($save) !== $prior)) throw new RuntimeException('BACKUP_FAILED');
            if (!is_dir(dirname($target))) {
                if (!mkdir(dirname($target), 0755, true) || !chmod(dirname($target), 0755)) throw new RuntimeException('DIRECTORY_FAILED');
            }
            $temp = $target.'.hzn-new-'.bin2hex(random_bytes(4)); $temporary[] = $temp;
            if (!copy($source, $temp) || digest($temp) !== $manifest['files'][$path]['sha256'] || !chmod($temp, 0644)) throw new RuntimeException('STAGING_FAILED');
            // Refuse a target modified after the global preflight.
            if (digest($target) !== $prior) throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
            if (!rename($temp, $target)) throw new RuntimeException('REPLACE_FAILED');
            $written[] = [$target, $prior !== null, $save];
        }
        file_put_contents($backup.'/restore-map.json', json_encode($written, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
        echo 'PUBLISHED 1.4.4: '.count($written).' storefront files; existing lessons, configuration and data preserved. Backup: '.basename($backup)."\n";
    }
} catch (Throwable $error) {
    $restoreFailed = false;
    foreach (array_reverse($written) as [$target, $prior, $save]) {
        if ($prior) { $temp = $target.'.hzn-restore'; if (!copy($save, $temp) || !chmod($temp, 0644) || !rename($temp, $target)) $restoreFailed = true; }
        elseif (is_file($target) && !unlink($target)) $restoreFailed = true;
    }
    $reason = $error instanceof RuntimeException && preg_match('/^[A-Z_]+$/D', $error->getMessage()) ? $error->getMessage() : 'PUBLISH_FAILED';
    fwrite(STDERR, 'STOP: '.$reason.($restoreFailed ? '; RESTORE_REQUIRES_ATTENTION' : '; published changes rolled back')."\n");
    $failed = true;
} finally {
    foreach ($temporary as $temp) if (is_file($temp)) @unlink($temp);
    if ($locked) rmdir($lock);
}
exit(isset($failed) ? 1 : 0);
