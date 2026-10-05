<?php
declare(strict_types=1);
// Maintenance only: never include or execute an inspected file or load a database.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);

function auditWalk(string $root, callable $visit, array &$errors): void {
    if (is_link($root)) { $visit($root); return; }
    if (!is_dir($root)) { if (file_exists($root)) $visit($root); return; }
    $visit($root);
    $names = @scandir($root);
    if ($names === false) { $errors[] = ['path'=>$root,'reason'=>'DIRECTORY_UNREADABLE']; return; }
    foreach ($names as $name) {
        if ($name === '.' || $name === '..') continue;
        auditWalk($root.'/'.$name, $visit, $errors);
    }
}
function auditMeta(string $path, string $home): array {
    $s = @lstat($path);
    if ($s === false) return ['path'=>substr($path, strlen($home)+1),'type'=>'unreadable','mode'=>'0000','error'=>'STAT_FAILED'];
    $kind = is_link($path) ? 'symlink' : (is_dir($path) ? 'directory' : (is_file($path) ? 'file' : 'other'));
    $row = ['path'=>substr($path,strlen($home)+1),'type'=>$kind,'bytes'=>$s['size'],
        'modified_utc'=>gmdate('c',$s['mtime']),'mode'=>sprintf('%04o',$s['mode'] & 07777)];
    if ($kind === 'symlink') $row['target'] = readlink($path);
    return $row;
}
function auditWrite(string $path, string $bytes): void {
    $h = @fopen($path, 'x');
    if (!$h) throw new RuntimeException('OUTPUT_CONFLICT');
    try {
        if (!chmod($path,0600)) throw new RuntimeException('OUTPUT_MODE_FAILED');
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $n = fwrite($h,substr($bytes,$offset));
            if ($n === false || $n === 0) throw new RuntimeException('OUTPUT_WRITE_FAILED');
            $offset += $n;
        }
    } finally { fclose($h); }
}
function auditMain(array $argv): void {
    if (count($argv) !== 3) throw new RuntimeException('USAGE_WEBROOT_PRIVATE_OUTPUT');
    $web = realpath($argv[1]); $home = $web ? dirname($web) : '';
    if (!$web || is_link($argv[1]) || $web !== rtrim($argv[1],'/') || basename($web) !== 'public_html')
        throw new RuntimeException('WEBROOT_INVALID');
    $out = rtrim($argv[2],'/');
    if (dirname($out) !== $home || !preg_match('/^\.horizons-audit-[A-Za-z0-9_-]+$/D',basename($out)) ||
        file_exists($out) || is_link($out)) throw new RuntimeException('PRIVATE_OUTPUT_INVALID');
    if (!mkdir($out,0700) || !chmod($out,0700)) throw new RuntimeException('PRIVATE_OUTPUT_FAILED');
    $errors=[]; $rows=[]; $texts=[]; $executables=[]; $indicators=[]; $writable=[]; $links=[];
    $legacy = ['index.php','application','system','ckeditor','phpstorm.php','maintenance.php','.idea','user_guide'];
    $isLegacy = static function(string $rel) use ($legacy): bool {
        foreach ($legacy as $prefix) if ($rel === $prefix || str_starts_with($rel,$prefix.'/')) return true;
        return false;
    };
    auditWalk($web, function(string $path) use (&$rows,&$texts,&$executables,&$indicators,&$writable,&$links,$home,$web,$isLegacy): void {
        $row=auditMeta($path,$home); $rel=substr($path,strlen($web)+1); $rows[]=$row;
        if ($row['type']==='symlink') { $links[]=$row; return; }
        if ((octdec($row['mode']) & 0002) !== 0) $writable[]=$row;
        if ($row['type']!=='file') return;
        $ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
        $executable=preg_match('/^(php[0-9]*|phtml|phar|cgi|pl)$/D',$ext)===1;
        if ($executable) {
            $row['sha256']=hash_file('sha256',$path); $row['legacy_candidate']=$isLegacy($rel); $executables[]=$row;
        }
        $textual=$executable || in_array($ext,['html','js','mjs','css','json','ini','yml','xml','txt'],true) || basename($path)==='.htaccess';
        if (!$textual || $row['bytes']>4194304 || preg_match('~(^|/)(config(?:-path)?\.php|.*\.sqlite|owner-vault\.json)$~i',$rel)) return;
        $raw=@file_get_contents($path);
        if ($raw===false) return;
        $texts[$rel]=['text'=>$raw,'legacy'=>$isLegacy($rel)];
        $checks=['eval_call'=>'/\beval\s*\(/i','encoded_execute'=>'/\b(?:assert|eval)\s*\(\s*(?:base64_decode|gzinflate|gzuncompress)/i',
            'shell_call'=>'/\b(?:shell_exec|passthru|system|exec)\s*\(/i','private_key_marker'=>'/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/',
            'auto_prepend'=>'/auto_(?:prepend|append)_file\s*=\s*[^\s;]+/i'];
        foreach ($checks as $name=>$pattern) if (preg_match_all($pattern,$raw,$matches,PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $hit) $indicators[]=['path'=>$row['path'],'indicator'=>$name,'line'=>substr_count(substr($raw,0,$hit[1]),"\n")+1];
        }
    },$errors);
    $references=[];
    foreach ($texts as $source=>$data) {
        if ($data['legacy']) continue;
        foreach ($legacy as $target) if (preg_match('~(?<![A-Za-z0-9_-])'.preg_quote($target,'~').'(?![A-Za-z0-9_-])~',$data['text']))
            $references[]=['source'=>'public_html/'.$source,'target'=>$target,'kind'=>'literal_candidate_reference'];
    }
    // Inspect private service code for dependencies, but never export contents or configuration values.
    foreach (['horizons-license/app','horizons-license/commerce','horizons-admin','horizons-learning','horizons-travel-delivery'] as $dir) {
        auditWalk($home.'/'.$dir,function(string $path) use (&$references,$legacy,$home): void {
            if (is_link($path) || !is_file($path) || filesize($path)>4194304 || strtolower(pathinfo($path,PATHINFO_EXTENSION))!=='php' ||
                preg_match('/(?:config|owner|vault|secret|key)/i',basename($path))) return;
            $raw=@file_get_contents($path); if ($raw===false) return;
            foreach ($legacy as $target) if (preg_match('~(?<![A-Za-z0-9_-])'.preg_quote($target,'~').'(?![A-Za-z0-9_-])~',$raw))
                $references[]=['source'=>substr($path,strlen($home)+1),'target'=>$target,'kind'=>'private_literal_candidate_reference'];
        },$errors);
    }
    $homeRows=[];
    foreach (scandir($home) ?: [] as $name) if ($name!=='.' && $name!=='..') $homeRows[]=auditMeta($home.'/'.$name,$home);
    $evidence=[];
    foreach (['.trash','.horizons-site-quarantine-20261005'] as $dir) {
        auditWalk($home.'/'.$dir,function(string $path) use (&$evidence,$home): void {
            if (is_link($path) || !is_file($path)) return;
            if (preg_match('/(?:ufo_shell\.php|(?:^|\/)(?:dl|nav)\.php|final_ok\.php7|lst2ok\.php7)(?:$|[._-])/i',$path)) {
                $row=auditMeta($path,$home); $row['sha256']=hash_file('sha256',$path); $evidence[]=$row;
            }
        },$errors);
    }
    $logSummary=[];
    $targets=['ufo_shell.php','dl.php','nav.php','final_ok.php7','lst2ok.php7','/fileman/'];
    foreach (glob($home.'/logs/*') ?: [] as $log) {
        if (is_link($log) || !is_file($log) || filesize($log)>268435456 || !str_contains(basename($log),'horizons-tr')) continue;
        $gz=str_ends_with($log,'.gz'); $h=$gz ? @gzopen($log,'r') : @fopen($log,'r');
        if (!$h) { $errors[]=['path'=>$log,'reason'=>'LOG_UNREADABLE']; continue; }
        $counts=[]; $read=0; $limited=false;
        while (($line=$gz ? gzgets($h,65536) : fgets($h,65536))!==false) {
            $read+=strlen($line); if($read>536870912){$limited=true;break;}
            foreach ($targets as $target) if(str_contains($line,$target)) {
                // No IPs, tokens, query strings, user agents, or raw log lines leave this script.
                $status=preg_match('/"\s+(\d{3})\s+/',$line,$m) ? $m[1] : 'unknown';
                $key=$target.' '.$status; $counts[$key]=($counts[$key]??0)+1;
            }
        }
        $gz ? gzclose($h) : fclose($h);
        $logSummary[]=['path'=>substr($log,strlen($home)+1),'matches'=>$counts,'decoded_bytes_read'=>$read,'limited'=>$limited];
    }
    $summary=['schema'=>1,'created_utc'=>gmdate('c'),'webroot'=>$web,'public_entries'=>count($rows),
        'executable_files'=>$executables,'heuristic_indicators'=>$indicators,'world_writable'=>$writable,'symlinks'=>$links,
        'legacy_candidate_references'=>$references,'known_evidence'=>$evidence,'access_log_indicators'=>$logSummary,
        'errors'=>$errors,'limits'=>['Literal references do not prove dynamic dependency absence.',
            'No customer databases, secrets, keys or configuration values loaded.',
            'No inspected PHP file executed; no symlinks traversed.',
            'Executable indicators are leads, not confirmation of compromise.',
            'Large text files above 4 MiB not content-scanned; logs are bounded.']];
    $json=static fn($value)=>json_encode($value,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE|JSON_THROW_ON_ERROR);
    auditWrite($out.'/public-inventory.jsonl',implode("\n",array_map($json,$rows))."\n");
    auditWrite($out.'/home-boundaries.json',$json($homeRows)."\n");
    auditWrite($out.'/summary.json',$json($summary)."\n");
    echo 'AUDIT_READY: '.count($rows).' public entries; '.count($executables).' executable candidates; private report: '.$out."\n";
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try { auditMain($argv); }
    catch (Throwable $e) { fwrite(STDERR,"AUDIT_STOP: ".(preg_match('/^[A-Z_]+$/D',$e->getMessage())?$e->getMessage():'INSPECTION_FAILED')."\n"); exit(1); }
}
