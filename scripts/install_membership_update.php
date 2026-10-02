<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
ini_set('display_errors','0');ini_set('log_errors','0');umask(0077);$written=[];
function membershipBackupDatabase(string $source,string $destination):void{
 if(file_exists($destination))throw new RuntimeException('BACKUP_TARGET_EXISTS');
 if(class_exists('SQLite3')&&method_exists('SQLite3','backup')){
  $reader=new SQLite3($source,SQLITE3_OPEN_READONLY);$reader->enableExceptions(true);$reader->busyTimeout(10000);
  $snapshot=new SQLite3($destination,SQLITE3_OPEN_READWRITE|SQLITE3_OPEN_CREATE);$snapshot->enableExceptions(true);$snapshot->busyTimeout(10000);
  try{if(!$reader->backup($snapshot)||$snapshot->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('BACKUP_FAILED');}
  finally{$snapshot->close();$reader->close();}
 }else{
  $db=new PDO('sqlite:'.$source);$db->exec('PRAGMA busy_timeout=10000');
  if(version_compare((string)$db->query('SELECT sqlite_version()')->fetchColumn(),'3.27.0','<'))throw new RuntimeException('BACKUP_ENGINE_REQUIRED');
  $db->exec('VACUUM INTO '.$db->quote($destination));unset($db);
  $check=new PDO('sqlite:'.$destination);if($check->query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('BACKUP_FAILED');unset($check);
 }
 chmod($destination,0600);
}
try{
 if(PHP_VERSION_ID<80200)throw new RuntimeException('PHP_82_REQUIRED');
 foreach(['pdo_sqlite','sodium','openssl'] as $ext)if(!extension_loaded($ext))throw new RuntimeException('PHP_EXTENSION_REQUIRED');
 $home=realpath(dirname(__DIR__));$web=realpath($home.'/public_html');if(!$home||!$web||str_contains(__DIR__,'/public_html/'))throw new RuntimeException('EXTRACT_BESIDE_PUBLIC_HTML');
 $pointer=$web.'/activation/config-path.php';if(!is_file($pointer))throw new RuntimeException('CONFIG_POINTER_MISSING');$configPath=require $pointer;$realConfig=is_string($configPath)?realpath($configPath):false;
 if(!$realConfig||!str_starts_with($realConfig,$home.'/')||str_starts_with($realConfig,$web.'/'))throw new RuntimeException('PRIVATE_CONFIG_REQUIRED');
 ob_start();try{$config=require $realConfig;}finally{ob_end_clean();}
 if(($config['payments_enabled']??true)!==false&&!extension_loaded('curl'))throw new RuntimeException('PHP_CURL_REQUIRED');
 $app=realpath($config['code_path']??'');if(!$app||!str_starts_with($app,$home.'/')||str_starts_with($app,$web.'/'))throw new RuntimeException('PRIVATE_SOURCE_REQUIRED');
 $manifest=json_decode(file_get_contents(__DIR__.'/manifest.json'),true,16,JSON_THROW_ON_ERROR);if(($manifest['version']??'')!=='1.4.4')throw new RuntimeException('PACKAGE_INVALID');
 foreach($manifest['baseline'] as $name=>$hash)if(!is_file($app.'/'.$name)||!hash_equals($hash,hash_file('sha256',$app.'/'.$name)))throw new RuntimeException('HOSTED_SOURCE_CHANGED');
 $targets=[];foreach($manifest['files'] as $path=>$hash){
  if(!preg_match('~^(app|commerce|public)/(?!.*(?:^|/)\.\.(?:/|$))[A-Za-z0-9_./-]+$~D',$path)||is_link(__DIR__.'/'.$path)||!is_file(__DIR__.'/'.$path)||!hash_equals($hash,hash_file('sha256',__DIR__.'/'.$path)))throw new RuntimeException('PACKAGE_CHECKSUM_FAILED');
  $parts=explode('/',$path,2);$target=match($parts[0]){'app'=>$app.'/'.$parts[1],'commerce'=>dirname($app).'/commerce/'.$parts[1],'public'=>$web.'/'.$parts[1]};
  for($dir=dirname($target);$dir!==$home&&strlen($dir)>strlen($home);$dir=dirname($dir))if(is_link($dir))throw new RuntimeException('TARGET_LINK');
  if(is_link($target)||(file_exists($target)&&!is_file($target)))throw new RuntimeException('TARGET_INVALID');
  if(str_starts_with($path,'public/learn/content/')&&is_file($target)&&!hash_equals($hash,hash_file('sha256',$target)))throw new RuntimeException('EXISTING_LESSON_DIFFERS');$targets[$path]=$target;
 }
 require_once __DIR__.'/app/Core.php';\Horizons\Store::preflight($config['database_path']);new \Horizons\Crypto($config);
 if(!(class_exists('SQLite3')&&method_exists('SQLite3','backup'))){$engine=new PDO('sqlite::memory:');if(version_compare((string)$engine->query('SELECT sqlite_version()')->fetchColumn(),'3.27.0','<'))throw new RuntimeException('BACKUP_ENGINE_REQUIRED');unset($engine);}
 if(($argv[1]??'')!=='--install'){file_put_contents(__DIR__.'/result.txt',"READY: checks passed. Nothing installed. PHP ".PHP_VERSION."; package 1.4.4; ".count($targets)." files.\n");echo "READY: see result.txt. Nothing installed.\n";exit;}
 $lock=fopen(dirname($app).'/membership-install.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('INSTALL_IN_PROGRESS');
 $backup=dirname($app).'/membership-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));if(!mkdir($backup,0700))throw new RuntimeException('BACKUP_FAILED');
 if(is_file($config['database_path']))membershipBackupDatabase($config['database_path'],$backup.'/activation.sqlite');
 $priority=static fn($p)=>match($p){'app/bootstrap.php'=>1,'app/features.php'=>2,'public/activation/index.php'=>3,default=>0};uksort($targets,static fn($a,$b)=>$priority($a)<=>$priority($b));
 foreach($targets as $path=>$target){
  if(!is_dir(dirname($target))&&!mkdir(dirname($target),str_starts_with($path,'public/')?0755:0700,true))throw new RuntimeException('DIRECTORY_FAILED');
  $prior=is_file($target);$save=$backup.'/'.str_replace('/','__',$path);if($prior&&!copy($target,$save))throw new RuntimeException('BACKUP_FAILED');
  $temp=$target.'.hzn-new-'.bin2hex(random_bytes(4));if(!copy(__DIR__.'/'.$path,$temp))throw new RuntimeException('COPY_FAILED');chmod($temp,str_starts_with($path,'public/')?0644:0600);
  if(!rename($temp,$target)){unlink($temp);throw new RuntimeException('REPLACE_FAILED');}$written[]=[$target,$prior,$save];
 }
 file_put_contents($backup.'/restore-map.json',json_encode($written,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
 file_put_contents(__DIR__.'/result.txt',"INSTALLED 1.4.4. Membership routes enabled; transfer collection remains disabled. Existing config, vault and progress preserved. Backups: ".basename($backup)."\n");echo "INSTALLED: see result.txt.\n";
}catch(Throwable $e){
 foreach(array_reverse($written) as [$target,$prior,$save]){if($prior)copy($save,$target);else @unlink($target);}
 $reason=$e instanceof RuntimeException&&preg_match('/^[A-Z_]+$/D',$e->getMessage())?$e->getMessage():'CHECK_OR_INSTALL_FAILED';@file_put_contents(__DIR__.'/result.txt',"STOP: ".$reason.". No private configuration values printed.\n");fwrite(STDERR,"STOP: ".$reason."; see result.txt.\n");exit(1);
}
