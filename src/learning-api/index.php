<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
require_once __DIR__.'/bootstrap.php';
try {
    if(empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')throw new \HorizonsLearning\ApiError('HTTPS_REQUIRED');
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){header('Allow: POST');throw new \HorizonsLearning\ApiError('METHOD_NOT_ALLOWED',405);}
    if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')throw new \HorizonsLearning\ApiError('FORBIDDEN',403);
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if($origin!=='' && $origin!=='https://'.($_SERVER['HTTP_HOST']??''))throw new \HorizonsLearning\ApiError('FORBIDDEN',403);
    if(!preg_match('#^application/json(?:\s*;|$)#i',$_SERVER['CONTENT_TYPE']??''))throw new \HorizonsLearning\ApiError('JSON_REQUIRED',415);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>\HorizonsLearning\LIMIT)throw new \HorizonsLearning\ApiError('PAYLOAD_TOO_LARGE',413);
    $raw=file_get_contents('php://input',false,null,0,\HorizonsLearning\LIMIT+1);
    if($raw===false || strlen($raw)>\HorizonsLearning\LIMIT)throw new \HorizonsLearning\ApiError('PAYLOAD_TOO_LARGE',413);
    try{$input=json_decode($raw,true,24,JSON_THROW_ON_ERROR);}catch(\Throwable $e){throw new \HorizonsLearning\ApiError('INVALID_JSON');}
    if(!is_array($input) || array_is_list($input) || !is_string($input['action']??null))throw new \HorizonsLearning\ApiError('INVALID_REQUEST');
    $action=$input['action'];unset($input['action']);
    $authorization=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';
    $token=preg_match('/^Bearer ([a-f0-9]{64})$/D',$authorization,$match)?$match[1]:'';
    $service=\HorizonsLearning\application($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__));
    $result=$service->dispatch($action,$input,$token,$_SERVER['REMOTE_ADDR']??'unknown');
    echo \HorizonsLearning\json($result);
}catch(\Throwable $e){
    $expected=$e instanceof \HorizonsLearning\ApiError;
    http_response_code($expected?$e->status:503);
    if($expected && $e->status===429)header('Retry-After: 60');
    echo \HorizonsLearning\json(['ok'=>false,'error'=>$expected?$e->reason:'SERVICE_UNAVAILABLE']+($expected?$e->details:[]));
}
