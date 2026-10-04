<?php
declare(strict_types=1);
// Publish one standalone public review harness. Lesson files and receipts are never opened.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0');
ini_set('log_errors', '0');
umask(0077);
const HZN_WORKBOOK_REVIEW_SOURCE_SHA256 = 'af3c2bd6cb358711d45b8c6f72d4f1b962007cb9f212041885bf733eab9d6634';
const HZN_WORKBOOK_REVIEW_RELATIVE = 'workbook-review/index.html';

function hznWorkbookReviewWrite(string $path, string $bytes): void {
    $temporary = $path . '.review-' . bin2hex(random_bytes(6));
    try {
        if (file_put_contents($temporary, $bytes) !== strlen($bytes)
            || !chmod($temporary, 0644) || !rename($temporary, $path)) {
            throw new RuntimeException('WORKBOOK_REVIEW_WRITE_FAILED');
        }
    } finally {
        if (is_file($temporary)) unlink($temporary);
    }
}

$lock = ''; $locked = false; $directory = ''; $directoryCreated = false;
$target = ''; $written = false; $failed = false; $restoreFailed = false;
try {
    if (count($argv) < 2 || count($argv) > 3 || (isset($argv[2]) && $argv[2] !== '--publish')) {
        throw new RuntimeException('WORKBOOK_REVIEW_ARGUMENTS_INVALID');
    }
    $input = rtrim($argv[1], '/');
    $repo = realpath(dirname(__DIR__));
    $web = realpath($input);
    if ($input === '' || is_link($input) || !$repo || !$web || !is_dir($web)
        || $web === '/' || $input !== $web || str_starts_with($repo . '/', $web . '/')
        || str_starts_with($web . '/', $repo . '/')) {
        throw new RuntimeException('WORKBOOK_REVIEW_ROOT_INVALID');
    }
    $source = $repo . '/src/workbook-review/index.html';
    if (is_link($source) || realpath($source) !== $source || !is_file($source)
        || filesize($source) < 100 || filesize($source) > 1048576) {
        throw new RuntimeException('WORKBOOK_REVIEW_SOURCE_INVALID');
    }
    $bytes = file_get_contents($source);
    if (!is_string($bytes) || !hash_equals(HZN_WORKBOOK_REVIEW_SOURCE_SHA256, hash('sha256', $bytes))) {
        throw new RuntimeException('WORKBOOK_REVIEW_SOURCE_CHANGED');
    }
    $directory = $web . '/workbook-review';
    $target = $web . '/' . HZN_WORKBOOK_REVIEW_RELATIVE;
    if (is_link($directory) || (file_exists($directory) && (!is_dir($directory) || realpath($directory) !== $directory))) {
        throw new RuntimeException('WORKBOOK_REVIEW_DIRECTORY_INVALID');
    }
    if (is_dir($directory)) {
        $entries = scandir($directory);
        if (!is_array($entries) || array_values(array_diff($entries, ['.', '..', 'index.html'])) !== []) {
            throw new RuntimeException('WORKBOOK_REVIEW_DIRECTORY_CONFLICT');
        }
    }
    if (is_link($target) || file_exists($target)) {
        if (is_link($target) || !is_file($target) || realpath($target) !== $target
            || !hash_equals(HZN_WORKBOOK_REVIEW_SOURCE_SHA256, hash_file('sha256', $target))
            || (fileperms($target) & 0777) !== 0644) {
            throw new RuntimeException('WORKBOOK_REVIEW_TARGET_CHANGED');
        }
        echo "CURRENT: standalone workbook review harness verified; lesson files untouched.\n";
        exit(0);
    }
    if (($argv[2] ?? '') !== '--publish') {
        echo "READY: one standalone public workbook review file; lesson files untouched.\n";
        exit(0);
    }
    $lock = dirname($web) . '/.horizons-workbook-review.lock';
    if (!mkdir($lock, 0700)) throw new RuntimeException('WORKBOOK_REVIEW_DEPLOYMENT_BUSY');
    $locked = true;
    if (!chmod($lock, 0700) || realpath($lock) !== $lock) throw new RuntimeException('WORKBOOK_REVIEW_LOCK_INVALID');
    if (!is_dir($directory)) {
        if (!mkdir($directory, 0755)) throw new RuntimeException('WORKBOOK_REVIEW_DIRECTORY_FAILED');
        $directoryCreated = true;
        if (!chmod($directory, 0755)) throw new RuntimeException('WORKBOOK_REVIEW_DIRECTORY_FAILED');
    }
    if (is_link($directory) || realpath($directory) !== $directory || file_exists($target) || is_link($target)) {
        throw new RuntimeException('WORKBOOK_REVIEW_TARGET_CHANGED');
    }
    hznWorkbookReviewWrite($target, $bytes);
    $written = true;
    // Verify after publication so any incomplete write is removed before retry.
    if (!is_file($target) || !hash_equals(HZN_WORKBOOK_REVIEW_SOURCE_SHA256, hash_file('sha256', $target))
        || (fileperms($target) & 0777) !== 0644) {
        throw new RuntimeException('WORKBOOK_REVIEW_VERIFY_FAILED');
    }
    echo "PUBLISHED: standalone workbook review harness; lesson files untouched.\n";
} catch (Throwable $error) {
    if ($written && is_file($target) && !unlink($target)) $restoreFailed = true;
    $reason = $error instanceof RuntimeException && preg_match('/^[A-Z_]+$/D', $error->getMessage())
        ? $error->getMessage() : 'WORKBOOK_REVIEW_PUBLISH_FAILED';
    fwrite(STDERR, 'STOP: ' . $reason . ($restoreFailed ? '; RESTORE_REQUIRES_ATTENTION' : '; no lesson files changed') . "\n");
    $failed = true;
} finally {
    if ($failed && $directoryCreated && !$restoreFailed && is_dir($directory)) rmdir($directory);
    if ($locked && is_dir($lock)) rmdir($lock);
}
exit($failed ? 1 : 0);
