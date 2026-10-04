<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require_once __DIR__.'/blending3-preservation.php';
require_once __DIR__.'/blending2-preservation.php';
try{$web=realpath($argv[1]??'');if(!$web||!hznB3State($web)||!hznBlending2SupersedingState($web))throw new RuntimeException('BLENDING3_RELEASE_REQUIRED');echo "OK: BLENDING3_SECTION_R2; 150 approved recordings; previous sections and languages preserved.\n";}catch(Throwable $e){fwrite(STDERR,'BLENDING3_VERIFY_FAILED: '.$e->getMessage()."\n");exit(1);}
