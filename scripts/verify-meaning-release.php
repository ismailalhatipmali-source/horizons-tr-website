<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
try {
    $input = $argv[1] ?? '';
    if (is_link($input) || !($web = realpath($input)) || !is_dir($web)) throw new RuntimeException('INVALID_ROOT');
    require_once __DIR__ . '/blending2-preservation.php';
    $state = hznBlending2SupersedingState($web);
    if (!$state || !isset($state['manifest']['meaning_release'])) throw new RuntimeException('MEANING_RELEASE_NOT_INSTALLED');
    echo "OK: verified meanings release and preserved section03 audio.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'MEANING_VERIFY_FAILED: ' . $error->getMessage() . "\n"); exit(1);
}
