<?php
declare(strict_types=1);
// Publish the private owner console, server FX quotes and optional Windows launcher.
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
    foreach (['pdo_sqlite','sodium','openssl','curl','SimpleXML'] as $extension) if (!extension_loaded($extension)) throw new RuntimeException('MISSING_PHP_EXTENSION');
    $repo = realpath(dirname(__DIR__)); $input = $argv[1] ?? '';
    if (is_link($input) || !($web = realpath($input)) || !is_dir($web)
        || str_starts_with($repo.'/', $web.'/') || str_starts_with($web.'/', $repo.'/')) throw new RuntimeException('INVALID_ROOT');
    $state = dirname($web).'/.horizons-deploy-'.basename($web);
    if (is_link($state)) throw new RuntimeException('SYMLINK_REJECTED');
    if (!is_dir($state) && !mkdir($state, 0700)) throw new RuntimeException('STATE_FAILED');
    $lock = $state.'/deploy.lock';
    if (!@mkdir($lock, 0700)) throw new RuntimeException('DEPLOYMENT_ALREADY_RUNNING');
    $locked = true;
    $manifest = json_decode(file_get_contents($repo.'/release-assets/admin-fx-20261002/manifest.json'), true, 16, JSON_THROW_ON_ERROR);
    if (($manifest['version'] ?? '') !== 'admin-fx-20261002' || empty($manifest['files']) || count($manifest['files']) > 1500) throw new RuntimeException('INVALID_MANIFEST');
    foreach ($manifest['requires'] as $path => $sha) {
        if (!hash_equals($sha, digest(safePath($web, $path)) ?? '')) throw new RuntimeException('WORKBOOK_UPDATE_REQUIRED');
    }
    $private = dirname($web).'/horizons-checkout-review';
    if (is_link($private) || (file_exists($private) && !is_dir($private))) throw new RuntimeException('PRIVATE_ROOT_INVALID');
    $admin = dirname($web).'/horizons-admin';
    if (is_link($admin) || (file_exists($admin) && !is_dir($admin))) throw new RuntimeException('PRIVATE_ROOT_INVALID');
    $changes = []; $total = 0;
    foreach ($manifest['files'] as $path => $entry) {
        $isPrivate = str_starts_with($path, 'private/') || str_starts_with($path, 'admin/');
        if (str_starts_with($path, 'private/')) {
            if (!in_array($path, ['private/ReviewOrders.php','private/ExchangeRates.php'], true)) throw new RuntimeException('UNAPPROVED_PATH');
            $sourceExpected = 'src/checkout/'.substr($path,8);
            $target = safePath($private, substr($path, 8));
        } elseif (str_starts_with($path, 'admin/')) {
            if (!in_array($path, ['admin/AdminStore.php','admin/AdminService.php','admin/AdminMailer.php'], true)) throw new RuntimeException('UNAPPROVED_PATH');
            $sourceExpected = 'src/admin/'.substr($path,6);$target = safePath($admin,substr($path,6));
        } else {
            if (!preg_match('~^public/(?:[a-z]{2}/(?:index|product|cart|checkout|distance-sales|pre-information|refund-cancellation|checkout-privacy)\.html|checkout\.(?:js|css)|site\.js|checkout-api/index\.php|admin/(?:index\.html|admin\.css|admin\.js|api\.php|\.htaccess)|downloads/HORIZONS-Arabic-Setup-1\.5\.0\.exe)$~D', $path)) throw new RuntimeException('UNAPPROVED_PATH');
            $publicPath = substr($path, 7);
            $sourceExpected = match($publicPath) {'checkout-api/index.php'=>'src/checkout/public-index.php','admin/index.html'=>'src/admin/index.html','admin/admin.css'=>'src/admin/admin.css','admin/admin.js'=>'src/admin/admin.js','admin/api.php'=>'src/admin/public-api.php','admin/.htaccess'=>'src/admin/public.htaccess','downloads/HORIZONS-Arabic-Setup-1.5.0.exe'=>'release-assets/windows-1.5.0/HORIZONS-Arabic-Setup-1.5.0.exe',default=>'dist/'.$publicPath};
            $target = safePath($web, $publicPath);
        }
        if (($entry['source'] ?? null) !== $sourceExpected) throw new RuntimeException('UNAPPROVED_SOURCE');
        $source = safePath($repo, $entry['source']);
        if (!is_int($entry['bytes']) || $entry['bytes'] < 1 || $entry['bytes'] > 2097152
            || !is_file($source) || filesize($source) !== $entry['bytes']
            || !hash_equals($entry['sha256'], digest($source) ?? '')) throw new RuntimeException('SOURCE_CHECKSUM_FAILED');
        $total += $entry['bytes']; if ($total > 20971520) throw new RuntimeException('PAYLOAD_TOO_LARGE');
        $current = digest($target);
        if ($current === $entry['sha256']) continue;
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
    if (($argv[2] ?? '') !== '--publish') { echo 'READY: '.count($changes)." changed admin/FX/Windows files; workbook and public baselines verified.\n"; }
    elseif (!$changes) { echo "CURRENT: admin/FX/Windows update already published.\n"; }
    else {
        if (!is_dir($private) || is_link($private.'/key.bin') || !is_file($private.'/key.bin') || filesize($private.'/key.bin')!==32) throw new RuntimeException('CHECKOUT_UPDATE_REQUIRED');
        if (!is_dir($admin) && !mkdir($admin,0700)) throw new RuntimeException('PRIVATE_ROOT_FAILED');
        $keyPath=$admin.'/key.bin';
        if (is_link($keyPath) || (file_exists($keyPath) && (!is_file($keyPath) || filesize($keyPath)!==32))) throw new RuntimeException('PRIVATE_KEY_INVALID');
        if (!file_exists($keyPath)) {$f=fopen($keyPath,'x');if(!$f)throw new RuntimeException('PRIVATE_KEY_FAILED');try{if(fwrite($f,random_bytes(32))!==32 || !chmod($keyPath,0600))throw new RuntimeException('PRIVATE_KEY_FAILED');}finally{fclose($f);}}
        $ownerPath=$admin.'/owner.json';
        if(is_link($ownerPath))throw new RuntimeException('OWNER_CONFIGURATION_INVALID');
        if(!file_exists($ownerPath)){$f=fopen($ownerPath,'x');if(!$f)throw new RuntimeException('OWNER_CONFIGURATION_FAILED');try{if(fwrite($f,'{"email":"info@horizons-tr.com"}')!==strlen('{"email":"info@horizons-tr.com"}') || !chmod($ownerPath,0600))throw new RuntimeException('OWNER_CONFIGURATION_FAILED');}finally{fclose($f);}}
        if((json_decode(file_get_contents($ownerPath),true)['email']??'')!=='info@horizons-tr.com')throw new RuntimeException('OWNER_CONFIGURATION_INVALID');
        $backup = $state.'/admin-fx-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
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
        echo 'PUBLISHED admin-fx-20261002: '.count($written).' files; existing lessons, mail configuration and activation data preserved. Backup: '.basename($backup)."\n";
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
