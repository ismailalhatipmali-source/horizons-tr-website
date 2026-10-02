<?php
declare(strict_types=1);
// Public walkthrough assets only; never opens workbook licences, mail or learner data.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);
$written=[];$temporary=[];$modes=[];$locked=false;$lock='';
function videoPath(string $root,string $path):string {
 if(!preg_match('~^[A-Za-z0-9][A-Za-z0-9_./-]*$~D',$path)||str_contains('/'.$path.'/','/../')||str_contains('/'.$path.'/','/./')||str_contains($path,'//'))throw new RuntimeException('INVALID_PATH');
 $p=$root;foreach(explode('/',$path) as $part){$p.='/'.$part;if(is_link($p))throw new RuntimeException('SYMLINK_REJECTED');}if(file_exists($p)&&!is_file($p))throw new RuntimeException('FILE_CONFLICT');return $p;
}
function videoHash(string $path):?string{return is_file($path)?hash_file('sha256',$path):null;}
try {
 $repo=realpath(dirname(__DIR__));$input=$argv[1]??'';$web=realpath($input);
 if(!$repo||!$web||!is_dir($web)||is_link($input)||str_starts_with($repo.'/',$web.'/')||str_starts_with($web.'/',$repo.'/'))throw new RuntimeException('INVALID_ROOT');
 $state=dirname($web).'/.horizons-deploy-'.basename($web);if(is_link($state))throw new RuntimeException('SYMLINK_REJECTED');if(!is_dir($state)&&!mkdir($state,0700))throw new RuntimeException('STATE_FAILED');$lock=$state.'/deploy.lock';if(!@mkdir($lock,0700))throw new RuntimeException('DEPLOYMENT_ALREADY_RUNNING');$locked=true;
 $manifest=json_decode(file_get_contents($repo.'/release-assets/workbook-videos-1.0.0/manifest.json'),true,16,JSON_THROW_ON_ERROR);
 $languages=explode(' ','en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja');
 if(($manifest['version']??'')!=='1.0.0'||count($manifest['files']??[])!==99)throw new RuntimeException('INVALID_MANIFEST');
 foreach($languages as $lang)foreach(['walkthrough.mp4','poster.jpg','walkthrough.vtt'] as $name)if(!isset($manifest['files']['assets/workbook-video/1.0.0/'.$lang.'/'.$name]))throw new RuntimeException('LANGUAGE_MISSING');
 $changes=[];$total=0;
 foreach($manifest['files'] as $path=>$entry){
  if(!preg_match('~^(?:assets/workbook-video/1\.0\.0/(?:\.htaccess|[a-z]{2}/(?:walkthrough\.mp4|poster\.jpg|walkthrough\.vtt))|workbook-video\.css|workbook-video-release\.json)$~D',$path)||($entry['source']??'')!=='dist/'.$path)throw new RuntimeException('UNAPPROVED_PATH');
  $source=videoPath($repo,$entry['source']);$target=videoPath($web,$path);
  if(!is_int($entry['bytes']??null)||$entry['bytes']<1||$entry['bytes']>4*1024*1024||!is_file($source)||filesize($source)!==$entry['bytes']||!hash_equals($entry['sha256'],videoHash($source)??''))throw new RuntimeException('SOURCE_CHECKSUM_FAILED');
  $total+=$entry['bytes'];if($total>96*1024*1024)throw new RuntimeException('PAYLOAD_TOO_LARGE');$current=videoHash($target);if($current===$entry['sha256'])continue;
  if($current!==($entry['before']??null))throw new RuntimeException('PUBLIC_BASELINE_CHANGED');$changes[$path]=[$source,$target,$current];
 }
 if(($argv[2]??'')!=='--publish'){echo 'READY: '.count($changes)." verified public walkthrough assets in 32 languages.\n";}
 else {
  $backup=$state.'/workbook-video-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));if(!mkdir($backup,0700))throw new RuntimeException('BACKUP_FAILED');
  foreach(array_keys($manifest['files']) as $path){$current=$web;$parts=explode('/',$path);array_pop($parts);foreach($parts as $part){$current.='/'.$part;if(!is_dir($current)){if(!mkdir($current,0755)||!chmod($current,0755))throw new RuntimeException('DIRECTORY_FAILED');}else{$prior=fileperms($current)&0777;if($prior!==0755){$modes[$current]=$prior;if(!chmod($current,0755))throw new RuntimeException('DIRECTORY_FAILED');}}}}
  foreach($changes as $path=>[$source,$target,$prior]){
   $save=$backup.'/'.$path;if(!is_dir(dirname($save))&&!mkdir(dirname($save),0700,true))throw new RuntimeException('BACKUP_FAILED');if($prior!==null&&(!copy($target,$save)||videoHash($save)!==$prior))throw new RuntimeException('BACKUP_FAILED');
   $temp=$target.'.hzn-new-'.bin2hex(random_bytes(4));$temporary[]=$temp;if(!copy($source,$temp)||!chmod($temp,0644)||videoHash($temp)!==$manifest['files'][$path]['sha256'])throw new RuntimeException('STAGING_FAILED');if(videoHash($target)!==$prior)throw new RuntimeException('PUBLIC_BASELINE_CHANGED');if(!rename($temp,$target))throw new RuntimeException('REPLACE_FAILED');$written[]=[$target,$prior!==null,$save];
  }
  file_put_contents($backup.'/restore-map.json',json_encode(['files'=>$written,'directory_modes'=>$modes],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));echo 'PUBLISHED: '.count($written)." public media files; 32 language videos available.\n";
 }
} catch(Throwable $error) {
 $restoreFailed=false;foreach(array_reverse($written) as [$target,$prior,$save]){if($prior){$temp=$target.'.hzn-restore';if(!copy($save,$temp)||!chmod($temp,0644)||!rename($temp,$target))$restoreFailed=true;}elseif(is_file($target)&&!unlink($target))$restoreFailed=true;}foreach($modes as $path=>$mode)if(!chmod($path,$mode))$restoreFailed=true;
 $reason=$error instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$error->getMessage())?$error->getMessage():'PUBLISH_FAILED';fwrite(STDERR,'STOP: '.$reason.($restoreFailed?'; RESTORE_REQUIRES_ATTENTION':'; published changes rolled back')."\n");$failed=true;
} finally {foreach($temporary as $temp)if(is_file($temp))@unlink($temp);if($locked)rmdir($lock);}
exit(isset($failed)?1:0);
