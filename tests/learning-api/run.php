<?php
declare(strict_types=1);
require __DIR__.'/../../src/learning-api/bootstrap.php';
use HorizonsLearning\{ApiError,Registration,Service};
use function HorizonsLearning\{json,utc};
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
function fails(callable $fn,string $reason):void {try{$fn();}catch(ApiError $e){check($e->reason===$reason,'Expected '.$reason.', got '.$e->reason);return;}throw new RuntimeException('Expected '.$reason);}
$directory=sys_get_temp_dir().'/horizons-learning-test-'.bin2hex(random_bytes(8));mkdir($directory,0700);
$registryPath=$directory.'/registry.sqlite';$registry=new PDO('sqlite:'.$registryPath);$registry->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$registry->exec('CREATE TABLE entitlements(id TEXT PRIMARY KEY,email_hash TEXT,revoked INTEGER,account_id TEXT,channel TEXT,starts_at INTEGER,expires_at INTEGER);CREATE TABLE devices(entitlement_id TEXT,device TEXT,key_hash TEXT);CREATE TABLE account_devices(account_id TEXT,device TEXT,key_hash TEXT);');
$now=1800000000;$pair=sodium_crypto_sign_keypair();$issuer=base64_encode(sodium_crypto_sign_publickey($pair));$secret=sodium_crypto_sign_secretkey($pair);
$rsa=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);$details=openssl_pkey_get_details($rsa);$public=preg_replace('/-----[^-]+-----|\s/','',$details['key']);$hash=hash('sha256',base64_decode($public));
$device=str_repeat('a',64);$otherDevice=str_repeat('b',64);
function signedLicense(string $account,string $license,string $device,string $hash,int $now,?int $expires=null,int $schema=3):array {
 global $secret;$l=['schema'=>$schema,'product'=>HorizonsLearning\PRODUCT,'license_id'=>$license,'device_id'=>$device,'public_key_sha256'=>$hash,'wrapped_key'=>base64_encode(str_repeat('x',256)),'max_devices'=>3,'issued_at'=>utc($now-10),'purchase_email'=>'fixture@example.test'];
 if($schema===3)$l+=['account_id'=>$account,'plan'=>$expires===null?'lifetime':'monthly','channel'=>'direct','starts_at'=>utc($now-100),'expires_at'=>$expires===null?null:utc($expires)];
 $raw=json($l);return ['payload'=>base64_encode($raw),'signature'=>base64_encode(sodium_crypto_sign_detached($raw,$secret))];
}
foreach(['acct_a'=>'license_a','acct_b'=>'license_b'] as $account=>$license){$s=$registry->prepare('INSERT INTO entitlements VALUES(?,?,?,?,?,?,?)');$s->execute([$license,hash('sha256',$account),0,$account,'direct',$now-100,null]);foreach([$device,$otherDevice] as $d){$s=$registry->prepare('INSERT INTO devices VALUES(?,?,?)');$s->execute([$license,$d,$hash]);$s=$registry->prepare('INSERT INTO account_devices VALUES(?,?,?)');$s->execute([$account,$d,$hash]);}}
$originalHash=hash_file('sha256',$registryPath);$registration=new Registration($registryPath,$issuer);$key=random_bytes(32);$service=new Service($directory.'/learning.sqlite',$key,$registration,function()use(&$now){return $now;});
function request(string $action,array $input=[],string $token=''):array {global $service;return $service->dispatch($action,$input,$token,'192.0.2.10');}
function nonce(array $challenge):string {
 global $rsa;openssl_private_decrypt(base64_decode($challenge['encrypted_nonce']),$em,$rsa,OPENSSL_NO_PADDING);
 $mgf=function(string $s,int $n){$v='';for($i=0;strlen($v)<$n;$i++)$v.=hash('sha256',$s.pack('N',$i),true);return substr($v,0,$n);};
 $seed=substr($em,1,32)^$mgf(substr($em,33),32);$db=substr($em,33)^$mgf($seed,strlen($em)-33);
 check($em[0]==="\0" && hash_equals(substr($db,0,32),hash('sha256',HorizonsLearning\PRODUCT.'/progress-auth',true)),'OAEP label');
 $body=ltrim(substr($db,32),"\0");check($body[0]==="\1" && strlen($body)===33,'OAEP nonce');return base64_encode(substr($body,1));
}
function login(string $account='acct_a',string $license='license_a',?string $d=null,?int $expires=null):string {
 global $device,$hash,$now,$public;$c=request('auth-challenge',['license'=>signedLicense($account,$license,$d??$device,$hash,$now,$expires),'public_key'=>$public]);$a=request('auth-verify',['challenge_id'=>$c['challenge_id'],'nonce'=>nonce($c)]);check($a['account_id']===$account,'Account derived server side');return $a['token'];
}
function doc(string $id,int $revision=0):array {return [
 'id'=>$id,'base_revision'=>$revision,'operation_id'=>bin2hex(random_bytes(16)),'consent'=>true,'nickname'=>'Learner 1',
 'settings'=>['locale'=>'ar','meaningLocale'=>'en','typography'=>['schemaVersion'=>1,'font'=>'noto-naskh','size'=>2]],
 'progress'=>['schemaVersion'=>'3.0','bookId'=>'horizons-arabic-complete','contentVersion'=>'0.3.0','audioRevision'=>'female-2026-09-24','locale'=>'ar','course'=>'alphabet','chapter'=>'baa','tab'=>'words','word'=>0,'quiz'=>0,'quizMode'=>'word','story'=>0,'frame'=>0,'form'=>'isolated','alphabetMode'=>'explore','letter'=>0,'meaning'=>true,'guide'=>true,'heard'=>[],'attempts'=>[],'written'=>[],'bookmarks'=>[]]];}
$passed=[];
$token=login();$second=login('acct_a','license_a',$otherDevice);$different=login('acct_b','license_b');$id=bin2hex(random_bytes(16));$first=doc($id);$saved=request('put',$first,$token);
check($saved['profile']['revision']===1,'Initial revision');check(request('get',['id'=>$id],$second)['profile']['id']===$id,'Second device restores');
fails(fn()=>request('get',['id'=>$id],$different),'PROFILE_NOT_FOUND');check(request('list',[],$different)['profiles']===[],'Account list isolation');$passed[]='cross_device_and_account_isolation';
$replay=request('put',$first,$token);check($replay['replayed']===true && $replay['profile']['revision']===1,'Idempotent replay');check(str_contains(json($replay),'"heard":{}'),'Empty maps retain object shape');
$changed=$first;$changed['nickname']='Changed';fails(fn()=>request('put',$changed,$token),'OPERATION_REUSED');
$stale=doc($id,0);fails(fn()=>request('put',$stale,$second),'REVISION_CONFLICT');$next=doc($id,1);$next['progress']['heard']=['word.baa-01'=>true];check(request('put',$next,$second)['profile']['revision']===2,'CAS success');
fails(fn()=>request('put',doc($id,1),$token),'REVISION_CONFLICT');$newReplay=request('put',$first,$token);check($newReplay['profile']['revision']===2 && $newReplay['acknowledged_revision']===1,'Replay returns current authoritative profile');$passed[]='revision_conflicts_and_retries';
$delete=['id'=>$id,'base_revision'=>2,'operation_id'=>bin2hex(random_bytes(16))];$removed=request('delete',$delete,$token);check(isset($removed['profile']['deleted_at']) && !isset($removed['profile']['progress']),'Deleted tombstone');
check(isset(request('put',$first,$token)['profile']['deleted_at']),'Old replay cannot resurrect');fails(fn()=>request('put',doc($id,3),$token),'REVISION_CONFLICT');check(isset(request('list',[],$second)['profiles'][0]['deleted_at']),'Tombstone sync');$passed[]='deletion_and_no_resurrection';
$bad=doc(bin2hex(random_bytes(16)));$bad['progress']['ink']=['private'=>'stroke'];fails(fn()=>request('put',$bad,$token),'INVALID_FIELD');unset($bad['progress']['ink']);$bad['consent']=false;fails(fn()=>request('put',$bad,$token),'CONSENT_REQUIRED');
$bad=doc(bin2hex(random_bytes(16)));$bad['settings']['email']='personal@example.test';fails(fn()=>request('put',$bad,$token),'INVALID_FIELD');
$bad=doc(bin2hex(random_bytes(16)));$bad['progress']['word']=20;fails(fn()=>request('put',$bad,$token),'INVALID_FIELD');
$bad=doc(bin2hex(random_bytes(16)));$bad['nickname']=str_repeat('x',262144);fails(fn()=>request('put',$bad,$token),'PAYLOAD_TOO_LARGE');
$bad=doc(bin2hex(random_bytes(16)));$bad['account_id']='acct_b';fails(fn()=>request('put',$bad,$token),'INVALID_FIELD');$passed[]='consent_and_allowlisted_payload_limits';
$c=request('auth-challenge',['license'=>signedLicense('acct_a','license_a',$device,$hash,$now),'public_key'=>$public]);$response=['challenge_id'=>$c['challenge_id'],'nonce'=>nonce($c)];request('auth-verify',$response);fails(fn()=>request('auth-verify',$response),'INVALID_AUTH');
$c=request('auth-challenge',['license'=>signedLicense('acct_a','license_a',$device,$hash,$now),'public_key'=>$public]);$response=['challenge_id'=>$c['challenge_id'],'nonce'=>nonce($c)];fails(fn()=>request('auth-verify',['challenge_id'=>$c['challenge_id'],'nonce'=>base64_encode(random_bytes(32))]),'INVALID_AUTH');fails(fn()=>request('auth-verify',$response),'INVALID_AUTH');
$c=request('auth-challenge',['license'=>signedLicense('acct_a','license_a',$device,$hash,$now),'public_key'=>$public]);$response=['challenge_id'=>$c['challenge_id'],'nonce'=>nonce($c)];$now+=61;fails(fn()=>request('auth-verify',$response),'INVALID_AUTH');
fails(fn()=>request('list',[],''),'AUTH_REQUIRED');$tampered=signedLicense('acct_a','license_a',$device,$hash,$now);$tampered['payload']=base64_encode('{}');fails(fn()=>request('auth-challenge',['license'=>$tampered,'public_key'=>$public]),'INVALID_AUTH');$passed[]='proof_possession_single_use_expiry_signature';
check(hash_file('sha256',$registryPath)===$originalHash,'No activation database writes');$passed[]='activation_database_read_only';
$registry->exec("UPDATE account_devices SET key_hash='replaced' WHERE account_id='acct_a'");fails(fn()=>request('list',[],$token),'DEVICE_REVOKED');$registry->exec("UPDATE account_devices SET key_hash='$hash' WHERE account_id='acct_a'");
$registry->exec("UPDATE entitlements SET revoked=1 WHERE id='license_a'");fails(fn()=>request('list',[],$token),'ENTITLEMENT_INACTIVE');$registry->exec("UPDATE entitlements SET revoked=0 WHERE id='license_a'");
$registry->exec("UPDATE entitlements SET expires_at=".($now-1)." WHERE id='license_a'");fails(fn()=>request('list',[],$token),'ENTITLEMENT_INACTIVE');$registry->exec("UPDATE entitlements SET expires_at=NULL WHERE id='license_a'");
$now+=901;fails(fn()=>request('list',[],$token),'AUTH_REQUIRED');$token=login('acct_a','license_a',null,$now+30);$now+=31;fails(fn()=>request('list',[],$token),'AUTH_REQUIRED');$passed[]='revocation_rotation_and_session_expiry';
// Schema 2 uses registry-derived account identity; no fabricated browser account.
$c=request('auth-challenge',['license'=>signedLicense('ignored','license_a',$device,$hash,$now,null,2),'public_key'=>$public]);check($c['account_id']==='acct_a','Legacy account derived');$passed[]='legacy_signed_license_account_mapping';
$token=login();$id=bin2hex(random_bytes(16));$put=doc($id);$put['nickname']='Private pseudonym';request('put',$put,$token);$dbBytes=file_get_contents($directory.'/learning.sqlite');check(!str_contains($dbBytes,'Private pseudonym') && !str_contains($dbBytes,'fixture@example.test') && !str_contains($dbBytes,$token),'No plaintext profile or token in storage');
fails(fn()=>new Service($directory.'/learning.sqlite',random_bytes(32),$registration,fn()=>$now),'SERVICE_UNAVAILABLE');$passed[]='encrypted_storage_and_key_loss_guard';
// Bootstrap locates the existing path and creates only a private sibling directory.
$home=$directory.'/home';mkdir($home,0700);mkdir($home.'/public_html',0755);mkdir($home.'/public_html/activation',0755);
file_put_contents($home.'/activation-config.php','<?php return '.var_export(['enabled'=>true,'database_path'=>$registryPath],true).';');
file_put_contents($home.'/public_html/activation/config-path.php','<?php return '.var_export($home.'/activation-config.php',true).';');
$before=hash_file('sha256',$registryPath);HorizonsLearning\application($home.'/public_html');$keyBefore=file_get_contents($home.'/horizons-learning/key.bin');HorizonsLearning\application($home.'/public_html');
check($keyBefore===file_get_contents($home.'/horizons-learning/key.bin'),'Stable initialized key');check((fileperms($home.'/horizons-learning')&0777)===0700 && (fileperms($home.'/horizons-learning/key.bin')&0777)===0600 && (fileperms($home.'/horizons-learning/progress.sqlite')&0777)===0600,'Private permissions');check(hash_file('sha256',$registryPath)===$before,'Bootstrap registry unchanged');
unlink($home.'/horizons-learning/key.bin');fails(fn()=>HorizonsLearning\application($home.'/public_html'),'SERVICE_UNAVAILABLE');$passed[]='zero_config_bootstrap_and_missing_key_fail_closed';
$now+=61;$token=login();
for($i=0;$i<51;$i++){$profile=bin2hex(random_bytes(16));request('put',doc($profile),$token);request('delete',['id'=>$profile,'base_revision'=>1,'operation_id'=>bin2hex(random_bytes(16))],$token);}
$page=request('list',[],$token);check(count($page['profiles'])===50 && is_string($page['cursor']),'Metadata page size');$page2=request('list',['cursor'=>$page['cursor']],$token);check(count($page2['profiles'])>0 && $page2['cursor']===null,'Metadata pagination');
foreach($page['profiles'] as $metadata)check(!isset($metadata['progress']) && !isset($metadata['nickname']),'Metadata only listing');
for($i=0;$i<49;$i++)request('put',doc(bin2hex(random_bytes(16))),$token);
fails(fn()=>request('put',doc(bin2hex(random_bytes(16))),$token),'PROFILE_LIMIT');$passed[]='paginated_tombstones_and_active_profile_limit';
$now+=61;for($i=0;$i<12;$i++)request('auth-challenge',['license'=>signedLicense('acct_a','license_a',$device,$hash,$now),'public_key'=>$public]);fails(fn()=>request('auth-challenge',['license'=>signedLicense('acct_a','license_a',$device,$hash,$now),'public_key'=>$public]),'RATE_LIMITED');$passed[]='challenge_rate_limit';
// Emit only a synthetic RSA fixture for the independent WebCrypto interop test.
openssl_pkey_export($rsa,$private);$c=HorizonsLearning\wrapNonce(str_repeat('N',32),openssl_pkey_get_public($details['key']),256);
file_put_contents($directory.'/interop.json',json(['private_key'=>$private,'encrypted_nonce'=>$c]));
echo json(['ok'=>true,'checks'=>$passed,'interop_fixture'=>$directory.'/interop.json'])."\n";
