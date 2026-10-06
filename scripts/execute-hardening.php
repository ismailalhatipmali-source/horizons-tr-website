<?php
declare(strict_types=1);
// A single private CLI transaction: back up, publish, HTTP-test, retain probes.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
umask(0077);
require_once __DIR__ . '/deploy-hardening.php';
function guardPath(string $path): string {
    if ($path === '' || $path[0] !== '/' || preg_match('~//|(?:^|/)\.{1,2}(?:/|$)|[\x00-\x1f]~', $path)) throw new RuntimeException('Invalid absolute path');
    $path = rtrim($path, '/'); $current = '';
    foreach (explode('/', ltrim($path, '/')) as $part) {
        $current .= '/' . $part;
        if (is_link($current)) throw new RuntimeException('Symbolic link rejected');
    }
    return $path;
}
function guardPrivate(string $path): void {
    guardPath($path);
    if ((!is_dir($path) && !mkdir($path, 0700)) || !chmod($path, 0700)) throw new RuntimeException('Private directory unavailable');
}
function guardWrite(string $path, string $bytes, int $mode = 0600): void {
    guardPath($path); $f = fopen($path, 'xb');
    if (!$f) throw new RuntimeException('Refusing an existing or inaccessible file');
    try {
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $written = fwrite($f, substr($bytes, $offset));
            if (!$written) throw new RuntimeException('Incomplete write');
            $offset += $written;
        }
        if (!fflush($f) || !fsync($f)) throw new RuntimeException('Flush failed');
    } finally { fclose($f); }
    if (!chmod($path, $mode) || hash_file('sha256', $path) !== hash('sha256', $bytes)) throw new RuntimeException('Write verification failed');
}
function guardHttp(string $base, string $route, string $nonce): array {
    $context = stream_context_create([
        'http'=>['method'=>'GET','timeout'=>12.0,'ignore_errors'=>true,'follow_location'=>0,'max_redirects'=>0,
            'header'=>['Cache-Control: no-cache','Connection: close'],'user_agent'=>'HORIZONS-private-hardening/1'],
        'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false],
    ]);
    $stream = @fopen($base . $route . '?hzn_guard=' . $nonce, 'rb', false, $context);
    if ($stream === false) throw new RuntimeException('Verified HTTP connection failed: ' . $route);
    try {
        $body = stream_get_contents($stream, 1048577);
        $meta = stream_get_meta_data($stream);
        if ($body === false || strlen($body)>1048576 || ($meta['timed_out']??false)) throw new RuntimeException('HTTP read failed or exceeded the limit: ' . $route);
        $status = 0;
        foreach ($meta['wrapper_data']??[] as $line) {
            if (preg_match('~^HTTP/[0-9.]+ ([0-9]{3})(?: |$)~D', $line, $match)) $status = (int)$match[1];
        }
        if ($status === 0) throw new RuntimeException('Missing HTTP status: ' . $route);
    } finally { fclose($stream); }
    return ['path'=>$route,'status'=>$status,'sha256'=>hash('sha256',$body),'body'=>$body];
}
function guardHealthy(string $base, string $nonce, ?array $before = null): array {
    $result = [];
    foreach (['/'=>200,'/learn/'=>200,'/try/'=>200,'/admin/'=>200,'/travel-download/'=>200,
        '/activation/'=>405,'/learning-api/'=>405,'/checkout-api/'=>200,'/manual-order-api/'=>200] as $route=>$expected) {
        $x = guardHttp($base, $route, $nonce);
        if ($x['status'] !== $expected) throw new RuntimeException('HTTP route failed: ' . $route);
        if ($expected === 405) {
            $json = json_decode($x['body'], true, 16, JSON_THROW_ON_ERROR);
            if (($json['error']??'') !== 'METHOD_NOT_ALLOWED') throw new RuntimeException('Unexpected API method response');
        } elseif (str_contains($route, '-api/')) {
            $json = json_decode($x['body'], true, 16, JSON_THROW_ON_ERROR);
            $mode = $route === '/checkout-api/' ? 'bank_review' : 'manual_email';
            if (($json['ok']??false) !== true || ($json['collection_enabled']??null) !== false || ($json['mode']??'') !== $mode) throw new RuntimeException('Unexpected checkout mode');
            $x['mode'] = $mode; $x['collection_enabled'] = false;
        } elseif ($before !== null && ($before[$route]['sha256']??'') !== $x['sha256']) {
            throw new RuntimeException('Public page bytes changed: ' . $route);
        }
        unset($x['body']); $result[$route] = $x;
    }
    return $result;
}

$run = null; $probes = []; $lock = null; $batch = null; $success = false; $exitCode = 1;
$record = ['schema'=>1,'status'=>'preparing','scope'=>'Apache root policy only; no ini, customer, cron or quarantine changes'];
try {
    $web = guardPath($argv[1]??''); $fixture = ($argv[3]??'') === '--fixture';
    $base = rtrim($argv[2]??'https://horizons-tr.com','/');
    if (!$fixture && ($web !== '/home2/horizonstr/public_html' || $base !== 'https://horizons-tr.com')) throw new RuntimeException('Production target mismatch');
    if ($fixture && (!preg_match('~^http://127[.]0[.]0[.]1:[0-9]+$~D',$base) || str_starts_with($web,'/home2/horizonstr/'))) throw new RuntimeException('Unsafe fixture target');
    $repo = guardPath(dirname(__DIR__));
    if (!is_dir($web) || str_starts_with($web.'/',$repo.'/') || str_starts_with($repo.'/',$web.'/')) throw new RuntimeException('Invalid document root');
    $namespaces = ['assets','downloads','updates','try','learn/content'];
    foreach ($namespaces as $namespace) {
        guardPath($web.'/'.$namespace);
        if (!is_dir($web.'/'.$namespace)) throw new RuntimeException('Static namespace missing: '.$namespace);
    }
    $state = dirname($web).'/.horizons-hardening-'.basename($web); guardPrivate($state);
    $lock = $state.'/verification.lock';
    if (!@mkdir($lock,0700)) { $lock = null; throw new RuntimeException('Another verification is running'); }
    $nonce = bin2hex(random_bytes(12)); $run = $state.'/run-'.gmdate('Ymd\THis\Z').'-'.$nonce; guardPrivate($run);
    $record['created_at_utc'] = gmdate('c'); $record['target'] = $web;
    $record['cli_runtime'] = ['version'=>PHP_VERSION,'sapi'=>PHP_SAPI,'allow_url_include'=>ini_get('allow_url_include'),
        'allow_url_fopen'=>ini_get('allow_url_fopen'),'loaded_ini'=>php_ini_loaded_file(),'web_sapi_effective'=>'unverified'];
    $record['execution'] = ['child_processes'=>false,'http_transport'=>'verified_php_streams'];
    guardPrivate($run.'/config-snapshots');
    foreach (['.htaccess','.user.ini','php.ini'] as $name) {
        $path = guardPath($web.'/'.$name);
        if (!file_exists($path)) continue;
        if (!is_file($path) || filesize($path)>1048576) throw new RuntimeException('Unsafe configuration file');
        $bytes = file_get_contents($path);
        if ($bytes === false) throw new RuntimeException('Configuration read failed');
        guardWrite($run.'/config-snapshots/'.$name,$bytes);
        $record['config_snapshots'][$name] = ['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),'original_mode'=>fileperms($path)&0777];
    }
    $before = guardHealthy($base,$nonce); $record['http_before'] = $before;
    $marker = 'HZN-INERT-PROBE-'.$nonce;
    $names = ['control.txt','probe.php','probe.PHP','probe.php7','probe.php82','probe.phtml','probe.pht','probe.phar','probe.phps',
        'probe.php.jpg','probe.jpg.php8','config-path.php','backup.sqlite','.env.probe'];
    foreach ($namespaces as $namespace) {
        $probe = $web.'/'.$namespace.'/hzn-guard-'.$nonce;
        if (!mkdir($probe,0755)) throw new RuntimeException('Probe directory unavailable: '.$namespace);
        $probes[$namespace] = $probe;
        if (!chmod($probe,0755)) throw new RuntimeException('Probe permissions failed: '.$namespace);
        foreach ($names as $name) guardWrite($probe.'/'.$name,$marker,0644);
        $control = guardHttp($base,'/'.$namespace.'/'.basename($probe).'/control.txt',$nonce);
        if ($control['status'] !== 200 || $control['body'] !== $marker) throw new RuntimeException('Control probe is not publicly readable: '.$namespace);
    }
    // Durable journal precedes publication, including all probe move mappings.
    $record['probe_original_paths'] = [];
    foreach ($probes as $probe) foreach ($names as $name) $record['probe_original_paths'][] = $probe.'/'.$name;
    guardWrite($run.'/preflight.json',json_encode($record,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n");
    $apply = hzn_execute('apply',$web); $batch = $apply['batch']??null;
    $record['publication'] = $apply;
    guardWrite($run.'/publication.json',json_encode($apply,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n");
    $record['http_after'] = guardHealthy($base,$nonce,$before);
    $checks = array_merge($names,['probe%2ephp','probe.%70hp','probe.php/extra','probe.php.jpg/extra','probe.jpg.php8/extra']);
    foreach ($probes as $namespace=>$probe) foreach ($checks as $name) {
        $x = guardHttp($base,'/'.$namespace.'/'.basename($probe).'/'.$name,$nonce);
        $exposed = str_contains($x['body'],$marker);
        $saved = $x; unset($saved['body']);
        $saved['marker_exposed'] = $exposed;
        $record['probe_checks'][$namespace.'/'.$name] = $saved;
        if ($name === 'control.txt') {
            if ($x['status'] !== 200 || $x['body'] !== $marker) throw new RuntimeException('Control probe changed after publication');
        } elseif ($x['status'] !== 403 || $exposed) throw new RuntimeException('Static execution/file access probe failed: '.$namespace.'/'.$name.'; status='.$x['status'].'; marker_exposed='.($exposed?'true':'false'));
    }
    $record['status'] = $batch === null ? 'verified_unchanged' : 'applied_http_verified';
    $record['web_ini_status'] = 'still_requires_actual_FPM_configuration_verification';
    $success = true; $exitCode = 0;
} catch (Throwable $error) {
    $record['status'] = 'failed'; $record['error'] = $error->getMessage();
    if ($batch !== null) {
        try {
            $record['rollback'] = ['exit_code'=>0,'receipt'=>hzn_execute('restore',$web,$batch)];
            $record['status'] = 'failed_restored';
            try { $record['http_after_rollback'] = guardHealthy($base,$nonce,$record['http_before']??null); }
            catch (Throwable $rollbackHttpError) { $record['rollback_http_error'] = $rollbackHttpError->getMessage(); }
        } catch (Throwable $restoreError) {
            $record['rollback'] = ['exit_code'=>1,'error'=>$restoreError->getMessage()];
            $record['status'] = 'failed_restore_requires_review';
        }
    }
} finally {
    if ($probes !== [] && $run !== null) {
        guardPrivate($run.'/probes-retained');
        foreach ($probes as $namespace=>$probe) {
        $retained = $run.'/probes-retained/'.str_replace('/','-',$namespace);
        if (is_dir($probe) && !is_link($probe) && rename($probe,$retained)) {
            chmod($retained,0700);
            foreach (glob($retained.'/*') as $file) if (is_file($file)&&!is_link($file)) chmod($file,0600);
            if (is_file($retained.'/.env.probe')) chmod($retained.'/.env.probe',0600);
            $record['retained_probe_directories'][$namespace] = $retained;
        } else { $record['probe_cleanup'] = 'move_failed_requires_review'; $record['status'] = 'probe_retention_requires_review'; $exitCode = 1; }
        }
    }
    if ($run !== null) {
        guardWrite($run.'/result.json',json_encode($record,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n");
        echo json_encode(['status'=>$record['status'],'result'=>$run.'/result.json','batch'=>$batch,
            'web_ini_status'=>$record['web_ini_status']??'unverified','scope'=>$record['scope']],JSON_THROW_ON_ERROR)."\n";
    } else fwrite(STDERR,'HORIZONS guarded execution stopped: '.($record['error']??'unknown')."\n");
    if ($lock !== null) rmdir($lock);
}
exit($exitCode);
