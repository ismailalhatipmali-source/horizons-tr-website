<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require_once __DIR__.'/blending3-preservation.php';
require_once __DIR__.'/blending2-preservation.php';
try {
    $input = $argv[1] ?? '';
    if ($input === '' || is_link($input) || !($web = realpath($input)) || !is_dir($web)) {
        throw new RuntimeException('BLENDING3_RELEASE_REQUIRED');
    }
    // Verify the approved encrypted release and every inherited asset before
    // correcting only the new public ciphertext directory's traversal mode.
    $state = hznB3State($web);
    if (!$state || !hznBlending2SupersedingState($web)) {
        throw new RuntimeException('BLENDING3_RELEASE_REQUIRED');
    }
    $learn = hznB3Path($web, 'learn');
    $directory = hznB3Path($learn, 'content/1.4.1/course/audio/blending3');
    if (realpath($learn) !== $learn || realpath($directory) !== $directory || !is_dir($directory)) {
        throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_REQUIRED');
    }
    $expected = [];
    foreach ($state['receipt']['audio_paths'] as $path) {
        $name = basename($path) . '.hzn';
        if (!preg_match('~^blending3_r2_0[123]_(?:00[1-9]|0[1-4][0-9]|050)\\.wav\\.hzn$~D', $name)
            || !is_file(hznB3Path($directory, $name))) {
            throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_INVALID');
        }
        $expected[] = $name;
    }
    $entries = scandir($directory);
    if ($entries === false) {
        throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_INVALID');
    }
    $actual = array_values(array_diff($entries, ['.', '..']));
    sort($expected);
    sort($actual);
    if (count($expected) !== 150 || count(array_unique($expected)) !== 150 || $actual !== $expected) {
        throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_INVALID');
    }
    clearstatcache(true, $directory);
    if ((fileperms($directory) & 07777) !== 0755) {
        if (!chmod($directory, 0755)) {
            throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_MODE_FAILED');
        }
        clearstatcache(true, $directory);
        if ((fileperms($directory) & 07777) !== 0755) {
            throw new RuntimeException('BLENDING3_CIPHERTEXT_DIRECTORY_MODE_FAILED');
        }
        echo "OK: BLENDING3_CIPHERTEXT_DIRECTORY_MODE; public encrypted audio directory 0755.\n";
    }
    echo "OK: BLENDING3_SECTION_R2; 150 approved recordings; previous sections and languages preserved.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'BLENDING3_VERIFY_FAILED: ' . $e->getMessage() . "\n");
    exit(1);
}
