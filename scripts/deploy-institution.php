<?php
declare(strict_types=1);
// Publish the annual 500-seat institution policy. No database or mail migration.
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
    foreach (['pdo_sqlite','sodium','openssl'] as $extension) if (!extension_loaded($extension)) throw new RuntimeException('MISSING_PHP_EXTENSION');
    $repo = realpath(dirname(__DIR__)); $input = $argv[1] ?? '';
    if (is_link($input) || !($web = realpath($input)) || !is_dir($web)
        || str_starts_with($repo.'/', $web.'/') || str_starts_with($web.'/', $repo.'/')) throw new RuntimeException('INVALID_ROOT');
    $state = dirname($web).'/.horizons-deploy-'.basename($web);
    if (is_link($state)) throw new RuntimeException('SYMLINK_REJECTED');
    if (!is_dir($state) && !mkdir($state, 0700)) throw new RuntimeException('STATE_FAILED');
    $lock = $state.'/deploy.lock';
    if (!@mkdir($lock, 0700)) throw new RuntimeException('DEPLOYMENT_ALREADY_RUNNING');
    $locked = true;
    $manifest = json_decode(file_get_contents($repo.'/release-assets/institution-20261003/manifest.json'), true, 16, JSON_THROW_ON_ERROR);
    if (($manifest['version'] ?? '') !== 'institution-20261003' || empty($manifest['files']) || count($manifest['files']) > 1500) throw new RuntimeException('INVALID_MANIFEST');
    foreach ($manifest['requires'] as $path => $sha) {
        if (!in_array(digest(safePath($web, $path)), is_array($sha)?$sha:[$sha], true)) throw new RuntimeException('WORKBOOK_UPDATE_REQUIRED');
    }
    $private = dirname($web).'/horizons-checkout-review';
    if (is_link($private) || !is_dir($private)) throw new RuntimeException('PRIVATE_ROOT_INVALID');
    $pointer = safePath($web, 'activation/config-path.php');
    if (!is_file($pointer)) throw new RuntimeException('CONFIG_POINTER_MISSING');
    $configPath = require $pointer;
    $home = realpath(dirname($web));
    if (!is_string($configPath) || is_link($configPath) || !($configReal=realpath($configPath)) || !str_starts_with($configReal,$home.'/') || str_starts_with($configReal,$web.'/')) throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
    ob_start();try {$config=require $configReal;}finally{ob_end_clean();}
    $app = realpath($config['code_path']??'');
    if (!$app || !str_starts_with($app,$home.'/') || str_starts_with($app,$web.'/') || is_link($config['code_path'])) throw new RuntimeException('PRIVATE_SOURCE_REQUIRED');
    $commerce=realpath(dirname($app).'/commerce');
    if (!$commerce || is_link(dirname($app).'/commerce') || !str_starts_with($commerce,$home.'/') || str_starts_with($commerce,$web.'/')) throw new RuntimeException('PRIVATE_SOURCE_REQUIRED');
    $changes = []; $total = 0;
    foreach ($manifest['files'] as $path => $entry) {
        $isPrivate = !str_starts_with($path,'public/');
        if (str_starts_with($path,'commerce/')) {
            if (!in_array($path,['commerce/MembershipLedger.php','commerce/PurchaseLedger.php'],true)) throw new RuntimeException('UNAPPROVED_PATH');
            $sourceExpected='src/commerce/'.substr($path,9);$target=safePath($commerce,substr($path,9));
        } elseif ($path==='private/products.json') {
            $sourceExpected='src/commerce/products.json';$target=safePath($private,'products.json');
        } else {
            if (!preg_match('~^public/(?:[a-z]{2}/(?:index|product|cart|checkout|terms|distance-sales)\.html|(?:products\.json|checkout\.js|site-commerce\.js)|admin/admin\.js|learn/(?:index\.html|membership-manager\.js|web-locales\.json|web-config\.js|sw\.js|asset-manifest\.json))$~D',$path)) throw new RuntimeException('UNAPPROVED_PATH');
            $publicPath=substr($path,7);
            $sourceExpected=str_starts_with($publicPath,'learn/')?'release-assets/1.4.6/files/'.$publicPath:($publicPath==='admin/admin.js'?'src/admin/admin.js':'dist/'.$publicPath);
            $target=safePath($web,$publicPath);
        }
        if (($entry['source'] ?? null) !== $sourceExpected) throw new RuntimeException('UNAPPROVED_SOURCE');
        $source = safePath($repo, $entry['source']);
        if (!is_int($entry['bytes']) || $entry['bytes'] < 1 || $entry['bytes'] > 2097152
            || !is_file($source) || filesize($source) !== $entry['bytes']
            || !hash_equals($entry['sha256'], digest($source) ?? '')) throw new RuntimeException('SOURCE_CHECKSUM_FAILED');
        $total += $entry['bytes']; if ($total > 20971520) throw new RuntimeException('PAYLOAD_TOO_LARGE');
        $current = digest($target);
        if ($current === $entry['sha256']) continue;
        // Preserve the subsequently approved single-letter correction on reruns.
        if ($path === 'public/learn/sw.js' && is_file($target)
            && file_get_contents($target) === str_replace("const SHELL = 'hzn-web-shell-' + VERSION;", "const SHELL = 'hzn-web-shell-' + VERSION + '-thaa-20261003';", file_get_contents($source))) continue;
        if ($path === 'public/learn/asset-manifest.json' && is_file($target)) {
            $live=json_decode(file_get_contents($target),true,32,JSON_THROW_ON_ERROR);
            $base=json_decode(file_get_contents($source),true,32,JSON_THROW_ON_ERROR);
            $audioPath='course/audio/female-final/alphabet.thaa.mp3';
            $audio=$live['files'][$audioPath]??[];
            $live['files'][$audioPath]=$base['files'][$audioPath];
            if ($live === $base && ($audio['url']??'')==='content/1.4.1/'.$audioPath.'.hzn') {
                $audioFile=safePath($web,'learn/'.$audio['url']);
                $vault=json_decode(file_get_contents($config['vault_path']),true,8,JSON_THROW_ON_ERROR);
                $key=base64_decode($vault['content_key']??'',true);
                $cipher=is_file($audioFile)?file_get_contents($audioFile):'';
                $plain=(is_string($key)&&strlen($key)===32&&strlen($cipher)>28)?openssl_decrypt(substr($cipher,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($cipher,0,12),substr($cipher,-16),'horizons-arabic-level1/'.$audioPath):false;
                if ($audio===['url'=>'content/1.4.1/'.$audioPath.'.hzn','sha256'=>hash('sha256',$cipher),'bytes'=>strlen($cipher),'mime'=>'audio/mpeg'] && is_string($plain)
                    && hash('sha256',$plain)==='77aaaf8101f7db0c28e180ac3cc0966211c18d8438826bff339975f43c24adaa') continue;
            }
        }
        $baseline = $entry['before'];
        if (is_array($baseline)) { $matches = in_array($current, $baseline, true); }
        elseif (is_string($baseline) && str_starts_with($baseline, 'git-sha1:') && $current !== null) {
            // Compare to the exact Git blob from the last published commit.
            $bytes = file_get_contents($target);
            $matches = hash_equals(substr($baseline, 9), sha1('blob '.strlen($bytes)."\0".$bytes));
        } else { $matches = $current === $baseline; }
        if (!$matches) throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
        $changes[$path] = [$source, $target, $current, $isPrivate ? 0600 : 0644];
    }
    if (($argv[2] ?? '') !== '--publish') { echo 'READY: '.count($changes)." changed institution policy files; exact private/public baselines verified.\n"; }
    elseif (!$changes) { echo "CURRENT: institution policy update already published.\n"; }
    else {
        if (!is_dir($private) || is_link($private.'/key.bin') || !is_file($private.'/key.bin') || filesize($private.'/key.bin')!==32) throw new RuntimeException('CHECKOUT_UPDATE_REQUIRED');
        $backup = $state.'/institution-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
        if (!mkdir($backup, 0700)) throw new RuntimeException('BACKUP_FAILED');
        foreach ($changes as $path => [$source, $target, $prior, $mode]) {
            $save = $backup.'/'.$path;
            if (!is_dir(dirname($save)) && !mkdir(dirname($save), 0700, true)) throw new RuntimeException('BACKUP_FAILED');
            if ($prior !== null && (!copy($target, $save) || digest($save) !== $prior)) throw new RuntimeException('BACKUP_FAILED');
            if (!is_dir(dirname($target))) {
                if (!mkdir(dirname($target), $mode === 0600 ? 0700 : 0755, true) || !chmod(dirname($target), $mode === 0600 ? 0700 : 0755)) throw new RuntimeException('DIRECTORY_FAILED');
            }
            $temp = $target.'.hzn-new-'.bin2hex(random_bytes(4)); $temporary[] = $temp;
            if (!copy($source, $temp) || digest($temp) !== $manifest['files'][$path]['sha256'] || !chmod($temp, $mode)) throw new RuntimeException('STAGING_FAILED');
            // Refuse a target modified after the global preflight.
            if (digest($target) !== $prior) throw new RuntimeException('PUBLIC_BASELINE_CHANGED');
            if (!rename($temp, $target)) throw new RuntimeException('REPLACE_FAILED');
            $written[] = [$target, $prior !== null, $save, $mode];
        }
        file_put_contents($backup.'/restore-map.json', json_encode($written, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
        echo 'PUBLISHED institution-20261003: '.count($written).' files; 500 institution seats; annual expiry, existing lessons and private data preserved. Backup: '.basename($backup)."\n";
    }
} catch (Throwable $error) {
    $restoreFailed = false;
    foreach (array_reverse($written) as [$target, $prior, $save, $mode]) {
        if ($prior) { $temp = $target.'.hzn-restore'; if (!copy($save, $temp) || !chmod($temp, $mode) || !rename($temp, $target)) $restoreFailed = true; }
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
