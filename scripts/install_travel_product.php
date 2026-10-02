<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}umask(0077);
try{
    $web=realpath($argv[1]??'');$zip=realpath($argv[2]??'');$repo=realpath(dirname(__DIR__));
    if(!$web||!is_dir($web)||!$zip||!is_file($zip)||is_link($argv[2])||str_starts_with($zip,$web.'/'))throw new RuntimeException('UPLOAD_ZIP_OUTSIDE_PUBLIC_HTML');
    $manifest=json_decode(file_get_contents($repo.'/release-assets/travel-kit-2.0.0/product.json'),true,8,JSON_THROW_ON_ERROR);
    if(filesize($zip)!==$manifest['size_bytes']||!hash_equals($manifest['sha256'],hash_file('sha256',$zip)))throw new RuntimeException('PRODUCT_HASH_MISMATCH');
    if(!class_exists('ZipArchive'))throw new RuntimeException('PHP_ZIP_REQUIRED');$z=new ZipArchive();if($z->open($zip)!==true)throw new RuntimeException('INVALID_ZIP');
    $required=['Agency_Documents.html','Worked_Example.html','Agency_Documents_A4.pdf','Agency_Documents_Letter.pdf','Worked_Example_A4.pdf','Operations_Blank.xlsx','Operations_Example.xlsx','Email_Scripts.txt','Email_Scripts.pdf','START_HERE.txt','START_HERE.pdf','Document_Index.txt','License.txt','License.pdf','Manrope_OFL.txt','Cairo_OFL.txt'];
    $dirs=[];for($i=0;$i<$z->numFiles;$i++){$n=$z->getNameIndex($i);if(str_contains($n,'..')||str_starts_with($n,'/'))throw new RuntimeException('INVALID_ZIP');if(preg_match('~^Agency_Kit_([A-Z]{2})/~',$n,$m))$dirs[strtolower($m[1])]=true;}
    $actual=array_keys($dirs);$expected=$manifest['languages'];sort($actual);sort($expected);if($actual!==$expected||count($actual)!==32)throw new RuntimeException('LANGUAGES_MISSING');
    foreach($manifest['languages'] as $lang)foreach($required as $name){$s=$z->statName('Agency_Kit_'.strtoupper($lang).'/'.$name);if(!$s||$s['size']<1)throw new RuntimeException('LANGUAGE_FILE_MISSING');}$z->close();
    $home=realpath(dirname($web));
    if(dirname($zip)===$home.'/horizons-product-uploads'){chmod(dirname($zip),0700);chmod($zip,0600);}
    $private=$home.'/horizons-travel-delivery';if(is_link($private)||(file_exists($private)&&!is_dir($private)))throw new RuntimeException('PRIVATE_DIRECTORY_INVALID');
    if(!is_dir($private)&&!mkdir($private,0700))throw new RuntimeException('PRIVATE_DIRECTORY_INVALID');chmod($private,0700);
    $target=$private.'/'.$manifest['filename'];if(is_link($target))throw new RuntimeException('PRIVATE_FILE_INVALID');
    if(!is_file($target)||!hash_equals(hash_file('sha256',$target),$manifest['sha256'])){
        $tmp=$private.'/.product-'.bin2hex(random_bytes(8));if(!copy($zip,$tmp)||!hash_equals(hash_file('sha256',$tmp),$manifest['sha256'])||!chmod($tmp,0600)||!rename($tmp,$target))throw new RuntimeException('INSTALL_FAILED');
    }
    $tmp=$private.'/.manifest-'.bin2hex(random_bytes(8));file_put_contents($tmp,json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));chmod($tmp,0600);if(!rename($tmp,$private.'/product.json'))throw new RuntimeException('INSTALL_FAILED');
    echo "INSTALLED: verified 32-language product outside public_html. No customer link was created or sent. Deploy HEAD to publish the private delivery service.\n";
}catch(Throwable $e){$s=preg_match('/^[A-Z0-9_]+$/D',$e->getMessage())?$e->getMessage():'INSTALL_FAILED';fwrite(STDERR,'STOP: '.$s."\n");exit(1);}
