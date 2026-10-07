<?php
declare(strict_types=1);
// CLI-only read audit. No discovered file is required, included, or executed.
if (PHP_SAPI !== 'cli' || count($argv) !== 3) { fwrite(STDERR, "Usage: php audit-public-metadata.php WEBROOT PRIVATE_REPORT\n"); exit(2); }
umask(0077);
try {
    $web = realpath($argv[1]);
    $parent = realpath(dirname($argv[2]));
    if (!$web || !is_dir($web) || is_link($argv[1]) || !$parent || is_link(dirname($argv[2]))) { throw new RuntimeException('Invalid audit paths'); }
    if ($parent === $web || str_starts_with($parent . '/', $web . '/')) { throw new RuntimeException('Report must be outside webroot'); }
    $report = $parent . '/' . basename($argv[2]);
    if (file_exists($report) || is_link($report)) { exit(0); }
    $lock = fopen($report . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { throw new RuntimeException('Audit is already running'); }
    if (file_exists($report) || is_link($report)) { exit(0); }
    $started = microtime(true);
    $queue = [$web]; $entries = []; $errors = []; $counts = ['file'=>0,'directory'=>0,'symlink'=>0,'special'=>0];
    $legacy = ['deploy-check.html','logo2.png','favicon.ico','favicon-128.png','favicon-16x16.png','favicon-196x196.png','favicon-32x32.png','favicon-96x96.png'];
    $refs = array_fill_keys($legacy, []);
    $complete = true; $textFiles = 0; $limitedText = [];
    while ($queue) {
        $dir = array_pop($queue);
        if (is_link($dir) || realpath($dir) !== $dir) { $errors[] = ['path'=>$dir,'error'=>'directory changed or linked']; continue; }
        $names = scandir($dir);
        if ($names === false) { $errors[] = ['path'=>$dir,'error'=>'cannot list']; continue; }
        foreach ($names as $name) {
            if ($name === '.' || $name === '..') { continue; }
            if (count($entries) >= 40000 || microtime(true)-$started > 45) { $complete=false; break 2; }
            $path=$dir.'/'.$name; $relative=substr($path,strlen($web)+1); $st=lstat($path);
            if ($st === false) { $errors[]=['path'=>$relative,'error'=>'cannot stat']; continue; }
            $type=($st['mode'] & 0170000);
            $kind=match($type){0100000=>'file',0040000=>'directory',0120000=>'symlink',default=>'special'};
            $item=['path'=>$relative,'type'=>$kind,'mode'=>sprintf('%04o',$st['mode'] & 07777),'bytes'=>$st['size'],'mtime'=>$st['mtime']];
            $counts[$kind]++;
            if ($kind==='symlink') { $item['target']=readlink($path); }
            elseif ($kind==='directory') { $queue[]=$path; }
            elseif ($kind==='file') {
                $flags=[];
                if (preg_match('/\.(?:php[0-9]*|phtml|pht|phar|phps)(?:\..*)?$/i',$name)) { $flags[]='php_extension'; }
                if (preg_match('/(?:^\.env|^\.user\.ini$|^php\.ini$|^error_log$|\.(?:sqlite3?(?:-wal|-shm)?|db|sql|bak|backup|old|pem|key|ini|log)$)/i',$name)) { $flags[]='sensitive_name'; }
                if (preg_match('#(?:^|/)(?:uploads?|data|private|backend|storage|cache|logs?|application|system|ckeditor|\.git|\.svn|\.hg)(?:/|$)#i',$relative)) { $flags[]='review_namespace'; }
                if ($flags) { $item['flags']=$flags; }
                if (($flags && in_array('php_extension',$flags,true)) || $name==='.htaccess') {
                    if ($st['size'] <= 2097152 && realpath($path)===$path && !is_link($path)) { $item['sha256']=hash_file('sha256',$path); }
                    else { $item['hash_skipped']=true; }
                }
                if (preg_match('/\.(?:html?|css|js|json)$/i',$name)) {
                    if ($st['size'] <= 2097152 && realpath($path)===$path && !is_link($path)) {
                        $body=file_get_contents($path); $textFiles++;
                        if ($body!==false) { foreach($legacy as $candidate) { if(str_contains($body,$candidate)) { $refs[$candidate][]=$relative; } } }
                        else { $errors[]=['path'=>$relative,'error'=>'cannot read text']; }
                    } else { $limitedText[]=$relative; }
                }
            }
            $entries[]=$item;
        }
    }
    usort($entries,fn($a,$b)=>strcmp($a['path'],$b['path']));
    $data=['schema_version'=>1,'recorded_utc'=>gmdate('c'),'scope'=>$web,'read_only_public_tree'=>true,'complete'=>$complete && !$errors,'limit_reached'=>!$complete,'counts'=>$counts,'errors'=>$errors,'entries'=>$entries,'legacy_reference_scan'=>['files_read'=>$textFiles,'limited_files'=>$limitedText,'matches'=>$refs,'absence_does_not_prove_unused'=>true],'runtime'=>['sapi'=>PHP_SAPI,'loaded_ini'=>php_ini_loaded_file(),'allow_url_include'=>ini_get('allow_url_include'),'allow_url_fopen'=>ini_get('allow_url_fopen'),'cli_is_not_web_evidence'=>true]];
    $json=json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE|JSON_THROW_ON_ERROR)."\n";
    $temp=$report.'.tmp'; $out=fopen($temp,'x');
    if(!$out) { throw new RuntimeException('Temporary report already exists or cannot be created'); }
    if(fwrite($out,$json)!==strlen($json)) { throw new RuntimeException('Incomplete report write'); }
    fflush($out); fclose($out); chmod($temp,0600);
    if(file_exists($report)||is_link($report)||!rename($temp,$report)) { throw new RuntimeException('Cannot publish private report'); }
    fwrite(STDOUT,"Private metadata audit saved; public files unchanged.\n");
} catch(Throwable $e) { fwrite(STDERR,$e->getMessage()."\n"); exit(1); }
