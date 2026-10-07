<?php
declare(strict_types=1);
// Cold-start test: real includes and the real --check CLI, no host or licence.
$repo = dirname(__DIR__);
require_once $repo . '/scripts/native-ui-plan.php';
$home = sys_get_temp_dir() . '/hzn-cold-check-' . bin2hex(random_bytes(8));
$web = $home . '/public_html';
mkdir($home, 0700); mkdir($web, 0755);
function coldTree(string $path): array {
    $result = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($iterator as $item) $result[$item->getPathname()] = [$item->isDir() ? 'dir' : hash_file('sha256', $item->getPathname()), $item->getPerms() & 0777];
    ksort($result); return $result;
}
try {
    $before = coldTree($home);
    for ($i = 0; $i < 2; $i++) {
        try { hznUiChain($web); throw new RuntimeException('UNEXPECTED_SUCCESS'); }
        catch (RuntimeException $e) { if ($e->getMessage() !== 'UI_PREDECESSOR_CHAIN') throw $e; }
        if (coldTree($home) !== $before) throw new RuntimeException('CHECK_WROTE_FILES');
    }
    echo "PASS cold_and_repeat_chain_return_controlled_missing_baseline\n";
    $process = proc_open([PHP_BINARY, $repo . '/scripts/deploy-native-ui.php', $web, '--check'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) throw new RuntimeException('PROCESS_FAILED');
    fclose($pipes[0]); $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); $exit = proc_close($process);
    if ($exit !== 1 || $out !== '' || trim($err) !== 'STOP: UI_PREDECESSOR_CHAIN') throw new RuntimeException('CLI_ERROR_NOT_CONTROLLED');
    if (coldTree($home) !== $before) throw new RuntimeException('CLI_WROTE_FILES');
    echo "PASS real_check_cli_fails_closed_without_files_or_secret_output\n";
    echo "RESULT 2/2 passed\n";
} finally {
    // Remove this test's two empty directories only; never recursively clean a host.
    rmdir($web); rmdir($home);
}
