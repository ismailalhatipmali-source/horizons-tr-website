<?php
declare(strict_types=1);
/* Explicit CLI-only publisher. Default is a read-only preflight. Does not run any
 * unrelated publisher. cPanel calls this after the existing guarded chain exits.
 * Never put this script, its private receipts, or backups in public_html.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);
require_once __DIR__ . '/native-ui-plan.php';
$chainLock = null; $key = null;
try {
    if (count($argv) < 2 || count($argv) > 3) hznUiFail('ARGUMENTS');
    $action = $argv[2] ?? '--check';
    if (!in_array($action, ['--check', '--publish', '--rollback', '--recover'], true)) hznUiFail('ARGUMENTS');
    $web = hznUiRoot(rtrim($argv[1], '/')); $repo = hznUiRoot(dirname(__DIR__));
    if (str_starts_with($repo . '/', $web . '/') || str_starts_with($web . '/', $repo . '/')) hznUiFail('REPOSITORY_LOCATION');
    if ($action !== '--check') {
        // The current production chain uses this same directory lock. Refuse overlap.
        if ($web !== '/home2/horizonstr/public_html' || $repo !== '/home2/horizonstr/repositories/horizons-tr-website-live') hznUiFail('PRODUCTION_ROOT');
        $head = hznUiRead($repo . '/.git/HEAD', null, 256);
        if (trim($head) !== 'ref: refs/heads/main') hznUiFail('PRODUCTION_BRANCH');
        $candidate = hznUiPath(dirname($web), '.horizons-production-chain.lock');
        if (file_exists($candidate) || !mkdir($candidate, 0700)) hznUiFail('PRODUCTION_BUSY');
        $chainLock = $candidate;
    }
    if ($action === '--recover' || $action === '--rollback') {
        $action === '--recover' ? hznUiRecover($web) : hznUiRollback($web);
        hznUiChain($web);
        echo "RESTORED: six original UI files; historical receipts retained. Reopen workbook tabs to verify browser behavior.\n";
    } else {
        $release = hznUiRelease($repo); $installed = hznUiState($web, $repo);
        if ($installed && $installed['journal_pending']) hznUiFail('RECOVERY_REQUIRED');
        [$focus, $trial] = hznUiChain($web); $key = hznUiKey($web);
        if ($installed) {
            hznUiVerifyPaid($web, $installed, $release, $key);
            echo "CURRENT: encrypted player, six UI files, media projections and predecessor chain verified; no writes.\n";
        } else {
            $plan = hznUiPrepare($web, $release, $focus, $trial, $key);
            if ($action === '--check') {
                echo "READY: six-file plan verified in memory; original player prefix and other media preserved. No files written. This is not a browser QA result.\n";
            } else {
                hznUiPublish($web, $plan['before'], $plan['after'], $plan['inherited'], $plan['metadata'],
                    function () use ($web, $repo, $release, $key): void {
                        $state = hznUiState($web, $repo); if (!$state) hznUiFail('POST_VERIFY');
                        hznUiVerifyPaid($web, $state, $release, $key); hznUiChain($web);
                    });
                echo "PUBLISHED: six-file UI transaction verified; private rollback retained. Browser audio, progress, offline access and physical-device checks still required.\n";
            }
        }
    }
} catch (Throwable $error) {
    // Exception text from PHP config, OpenSSL or a path is never disclosed.
    $code = $error instanceof RuntimeException && preg_match('/^[A-Z0-9_]+$/D', $error->getMessage()) ? $error->getMessage() : 'UI_OPERATION_FAILED';
    fwrite(STDERR, 'STOP: ' . $code . "\n"); $failed = true;
} finally {
    if (is_string($key) && function_exists('sodium_memzero')) sodium_memzero($key);
    if ($chainLock !== null && !rmdir($chainLock)) { fwrite(STDERR, "STOP: UI_LOCK_CLEANUP\n"); $failed = true; }
}
exit(isset($failed) ? 1 : 0);
