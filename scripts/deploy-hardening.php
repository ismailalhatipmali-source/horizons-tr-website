<?php
declare(strict_types=1);

// CLI only: changes one Apache file, retains every displaced byte privately.
// PHP/FPM ini settings and application/customer data are deliberately separate.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
umask(0077);

function hzn_fail(string $message): never { throw new RuntimeException($message); }
function hzn_path(string $path): string {
    if ($path === '' || $path[0] !== '/' || preg_match('~(?:^|/)\.{1,2}(?:/|$)|//|[\x00-\x1f]~', $path)) {
        hzn_fail('Use a normalized absolute path.');
    }
    $path = rtrim($path, '/');
    if ($path === '') { hzn_fail('The filesystem root is not a document root.'); }
    $current = '';
    foreach (explode('/', ltrim($path, '/')) as $part) {
        $current .= '/' . $part;
        if (is_link($current)) { hzn_fail('Symbolic links are not accepted.'); }
    }
    return $path;
}
function hzn_read(string $path): string {
    hzn_path($path);
    if (!is_file($path) || filesize($path) > 1048576) { hzn_fail('Missing, special or oversized configuration file.'); }
    $value = file_get_contents($path);
    if ($value === false) { hzn_fail('Could not read configuration.'); }
    return $value;
}
function hzn_write(string $path, string $bytes, int $mode = 0600): void {
    hzn_path($path);
    $stream = fopen($path, 'xb');
    if ($stream === false) { hzn_fail('Refusing to replace an existing staging file.'); }
    try {
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $count = fwrite($stream, substr($bytes, $offset));
            if ($count === false || $count === 0) { hzn_fail('Incomplete configuration write.'); }
            $offset += $count;
        }
        if (!fflush($stream) || !fsync($stream)) { hzn_fail('Could not flush configuration.'); }
    } finally { fclose($stream); }
    if (!chmod($path, $mode) || hash_file('sha256', $path) !== hash('sha256', $bytes)) {
        hzn_fail('Staging hash or permissions verification failed.');
    }
}
function hzn_policy(): string {
    $policy = hzn_read(dirname(__DIR__) . '/src/security/public.htaccess');
    return rtrim($policy, "\r\n") . "\n";
}
function hzn_compose(string $original, string $policy): string {
    $begin = '# BEGIN HORIZONS HARDENING'; $end = '# END HORIZONS HARDENING';
    $begins = substr_count($original, $begin); $ends = substr_count($original, $end);
    if ($begins !== $ends || $begins > 1) { hzn_fail('Malformed or duplicate hardening markers.'); }
    if ($begins === 1) {
        $pattern = '/^# BEGIN HORIZONS HARDENING\r?\n.*?^# END HORIZONS HARDENING(?:\r?\n|$)/ms';
        $updated = preg_replace_callback($pattern, static fn(array $match): string => $policy, $original, 1, $count);
        if ($updated === null || $count !== 1) { hzn_fail('Malformed hardening marker boundaries.'); }
        return $updated;
    }
    return $original . ($original !== '' && !str_ends_with($original, "\n") ? "\n" : '') . $policy;
}
function hzn_private(string $directory): void {
    hzn_path($directory);
    if (!is_dir($directory) && !mkdir($directory, 0700)) { hzn_fail('Could not create private state directory.'); }
    if (!chmod($directory, 0700)) { hzn_fail('Could not secure private state directory.'); }
}

$lock = null; $exitCode = 0;
try {
    $action = $argv[1] ?? ''; $web = hzn_path($argv[2] ?? '');
    if (!in_array($action, ['status', 'apply', 'restore'], true) || !is_dir($web)) {
        hzn_fail('Usage: php scripts/deploy-hardening.php status|apply WEBROOT; restore WEBROOT BATCH');
    }
    $repo = hzn_path(dirname(__DIR__));
    if (str_starts_with($repo . '/', $web . '/') || str_starts_with($web . '/', $repo . '/')) {
        hzn_fail('Repository and document root must be separate.');
    }
    $target = $web . '/.htaccess'; hzn_path($target);
    if (file_exists($target) && !is_file($target)) { hzn_fail('Apache target is not a regular file.'); }
    $exists = is_file($target); $original = $exists ? hzn_read($target) : '';
    $state = dirname($web) . '/.horizons-hardening-' . basename($web);
    if ($action !== 'restore') {
        $updated = hzn_compose($original, hzn_policy());
        $status = $updated === $original ? 'unchanged' : 'pending';
        if ($action === 'status' || $status === 'unchanged') {
            echo json_encode(['status' => $status, 'target' => $target, 'sha256' => hash('sha256', $original)], JSON_THROW_ON_ERROR) . "\n";
            exit(0);
        }
    }
    hzn_private($state); $lock = $state . '/lock';
    if (!@mkdir($lock, 0700)) { $lock = null; hzn_fail('Hardening is locked; inspect the existing operation before retrying.'); }
    if ($action === 'apply') {
        $batch = $state . '/batch-' . gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(8));
        hzn_private($batch);
        $mode = $exists ? (fileperms($target) & 0777) : null;
        hzn_write($batch . '/root.htaccess.original', $original);
        hzn_write($batch . '/publication.pending', $updated, 0644);
        $manifest = ['schema' => 1, 'target' => $target, 'existed' => $exists, 'original_mode' => $mode,
            'original_sha256' => hash('sha256', $original), 'published_sha256' => hash('sha256', $updated),
            'published_mode' => 0644, 'created_at_utc' => gmdate('c')];
        hzn_write($batch . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n");
        // Optimistic guard: never overwrite a concurrent operator's edits.
        if (is_file($target) !== $exists || ($exists && hzn_read($target) !== $original)) {
            hzn_fail('Apache configuration changed during preparation; nothing published.');
        }
        hzn_path($target);
        if (!rename($batch . '/publication.pending', $target)) { hzn_fail('Atomic publication failed.'); }
        if (hash_file('sha256', $target) !== $manifest['published_sha256']) { hzn_fail('Publication verification failed; retained backup requires review.'); }
        echo json_encode(['status' => 'applied', 'batch' => $batch, 'target' => $target,
            'sha256' => $manifest['published_sha256'], 'host_http_verification' => 'required'], JSON_THROW_ON_ERROR) . "\n";
    } else {
        $batch = hzn_path($argv[3] ?? '');
        if (dirname($batch) !== $state || !preg_match('/^batch-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{16}$/', basename($batch))) {
            hzn_fail('Restore batch is outside this document root private state.');
        }
        $manifest = json_decode(hzn_read($batch . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        if (($manifest['schema'] ?? null) !== 1 || ($manifest['target'] ?? '') !== $target || !is_bool($manifest['existed'] ?? null)) {
            hzn_fail('Invalid restore manifest.');
        }
        $saved = hzn_read($batch . '/root.htaccess.original');
        if (hash('sha256', $saved) !== ($manifest['original_sha256'] ?? '')) { hzn_fail('Backup hash mismatch; refusing restore.'); }
        if (!$exists || hash('sha256', $original) !== ($manifest['published_sha256'] ?? '')) {
            hzn_fail('Current Apache bytes differ from this batch; refusing to overwrite later changes.');
        }
        $restore = $state . '/restore-' . gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(8));
        hzn_private($restore);
        // The displaced hardened configuration is also retained, never deleted.
        hzn_write($restore . '/root.htaccess.displaced', $original);
        if ($manifest['existed']) {
            $mode = $manifest['original_mode'] ?? null;
            if (!is_int($mode) || $mode < 0 || $mode > 0777) { hzn_fail('Invalid original mode.'); }
            hzn_write($restore . '/restoration.pending', $saved, $mode);
            if (hzn_read($target) !== $original || !rename($restore . '/restoration.pending', $target)) { hzn_fail('Restore conflict or atomic restore failure.'); }
            if (hash_file('sha256', $target) !== $manifest['original_sha256']) { hzn_fail('Restore verification failed.'); }
        } else {
            if (hzn_read($target) !== $original || !rename($target, $restore . '/root.htaccess.removed-from-public')) { hzn_fail('Restore conflict or move failure.'); }
            chmod($restore . '/root.htaccess.removed-from-public', 0600);
        }
        echo json_encode(['status' => 'restored', 'target' => $target, 'retained_displaced_configuration' => $restore], JSON_THROW_ON_ERROR) . "\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'HORIZONS hardening stopped: ' . $error->getMessage() . "\n");
    $exitCode = 1;
} finally {
    if ($lock !== null) { rmdir($lock); }
}
exit($exitCode);
