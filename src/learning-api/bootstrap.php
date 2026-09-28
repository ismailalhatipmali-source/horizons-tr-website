<?php
declare(strict_types=1);
namespace HorizonsLearning;
require_once __DIR__.'/Core.php';

/** Resolve the existing activation configuration without loading its application. */
function application(string $documentRoot): Service {
    foreach (['pdo_sqlite','sodium','openssl'] as $extension) if (!extension_loaded($extension))throw new ApiError('SERVICE_UNAVAILABLE',503);
    $root=realpath($documentRoot);
    if(!$root || !is_dir($root))throw new ApiError('SERVICE_UNAVAILABLE',503);
    $configPath=getenv('HORIZONS_LICENSE_CONFIG');
    if(!$configPath){
        $locator=$root.'/activation/config-path.php';
        if(is_file($locator))$configPath=require $locator;
        elseif(is_file($root.'/activation/config.php'))$configPath=$root.'/activation/config.php';
    }
    if(!is_string($configPath) || !is_file($configPath))throw new ApiError('SERVICE_UNAVAILABLE',503);
    $config=require $configPath;
    if(!is_array($config) || ($config['enabled']??false)!==true || !is_string($config['database_path']??null))throw new ApiError('SERVICE_UNAVAILABLE',503);
    // Registration is read-only. The vault, SMTP, data key and activation bootstrap are unused.
    $registration=new Registration($config['database_path']);
    unset($config);
    $directory=dirname($root).'/horizons-learning';
    if(is_link($directory))throw new ApiError('SERVICE_UNAVAILABLE',503);
    $old=umask(0077);
    try {
        if(!is_dir($directory) && !mkdir($directory,0700) && !is_dir($directory))throw new ApiError('SERVICE_UNAVAILABLE',503);
        if(!chmod($directory,0700))throw new ApiError('SERVICE_UNAVAILABLE',503);
        $real=realpath($directory);
        if(!$real || $real===$root || str_starts_with($real,$root.DIRECTORY_SEPARATOR))throw new ApiError('SERVICE_UNAVAILABLE',503);
        $keyPath=$real.'/key.bin';$dbPath=$real.'/progress.sqlite';$lockPath=$real.'/initialization.lock';
        foreach([$keyPath,$dbPath,$lockPath] as $path)if(is_link($path))throw new ApiError('SERVICE_UNAVAILABLE',503);
        $lock=fopen($lockPath,'c');if(!$lock || !flock($lock,LOCK_EX))throw new ApiError('SERVICE_UNAVAILABLE',503);
        try {
            if(!is_file($keyPath)) {
                // Missing an existing key is an error, never a reset of old learner data.
                if(is_file($dbPath))throw new ApiError('SERVICE_UNAVAILABLE',503);
                $handle=fopen($keyPath,'x');if(!$handle)throw new ApiError('SERVICE_UNAVAILABLE',503);
                try {if(fwrite($handle,random_bytes(32))!==32 || !fflush($handle))throw new ApiError('SERVICE_UNAVAILABLE',503);if(function_exists('fsync'))fsync($handle);}finally{fclose($handle);}
            }
            if(!chmod($keyPath,0600))throw new ApiError('SERVICE_UNAVAILABLE',503);
            $key=file_get_contents($keyPath);
            if($key===false || strlen($key)!==32)throw new ApiError('SERVICE_UNAVAILABLE',503);
            return new Service($dbPath,$key,$registration,fn()=>time());
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    } finally {umask($old);}
}
