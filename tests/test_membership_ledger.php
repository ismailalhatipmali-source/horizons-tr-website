<?php
declare(strict_types=1);
require __DIR__.'/test_purchase_ledger.php';
require __DIR__.'/../src/commerce/MembershipLedger.php';
use HorizonsCommerce\PurchaseLedger;
use HorizonsCommerce\BankVerifier;
use HorizonsCommerce\MembershipLedger;
use HorizonsCommerce\MembershipIssuer;
$root=sys_get_temp_dir().'/hzn-members-'.bin2hex(random_bytes(6));mkdir($root,0700);mkdir($root.'/public_html',0700);
$settings=['charges_enabled'=>true,'price_approved'=>true,'bank_adapter_approved'=>true,'activation_adapter_approved'=>true,'product'=>'horizons-arabic-level1','merchant_id'=>'fake-merchant','terminal_id'=>'fake-terminal','accounts'=>[
 'individual'=>['plans'=>['monthly'=>['amount_minor'=>999,'currency'=>'USD'],'annual'=>['amount_minor'=>9900,'currency'=>'USD'],'lifetime'=>['amount_minor'=>15000,'currency'=>'USD']]],
 'family'=>['plans'=>['monthly'=>['amount_minor'=>2000,'currency'=>'USD'],'annual'=>['amount_minor'=>20000,'currency'=>'USD'],'lifetime'=>['amount_minor'=>25000,'currency'=>'USD']]],
 'institution'=>['plans'=>['annual'=>['amount_minor'=>100000,'currency'=>'USD']]]]];
try {
 $p=new PurchaseLedger($root.'/purchases.sqlite',$root.'/public_html',$settings);$key=random_bytes(32);
 rejects(fn()=>new MembershipLedger($root.'/public_html/members.sqlite',$root.'/public_html',$key),'PRIVATE_DATABASE_REQUIRED');
 $m=new MembershipLedger($root.'/members.sqlite',$root.'/public_html',$key);
 rejects(fn()=>new MembershipLedger($root.'/members.sqlite',$root.'/public_html',random_bytes(32)),'MEMBERSHIP_KEY_CHANGED');
 $now=time();
 $owner=function(string $type,string $plan,string $email,string $account)use($p,$m){
  $o=$p->create($email,$plan,$type);rejects(fn()=>$m->fulfilOwner($o['order_id'],$p),'VERIFIED_ACCESS_REQUIRED');
  $bank=new class($o) implements BankVerifier {public function __construct(private array $o){}public function querySale(string $id):array{return ['status'=>'sale_confirmed','merchant_id'=>'fake-merchant','terminal_id'=>'fake-terminal','transaction_id'=>$this->o['transaction_id'],'order_id'=>$this->o['order_id'],'currency'=>'USD','amount_minor'=>$this->o['amount_minor']];}};
  $p->confirm($o['order_id'],$bank);$payload=$p->jobs($o['order_id'])[0]['payload'];check($payload['account_type']===$type&&$payload['device_policy']==='any_device');
  $p->markAccessGranted($o['order_id'],$account);$g=$m->fulfilOwner($o['order_id'],$p);check($m->fulfilOwner($o['order_id'],$p)['id']===$g['id']);return $g;
 };
 rejects(fn()=>$p->create('x@example.test','lifetime','institution'),'ACCOUNT_TYPE_INVALID');rejects(fn()=>$p->create('x@example.test','monthly','institution'),'ACCOUNT_TYPE_INVALID');
 $individual=$owner('individual','lifetime','solo@example.test','solo-existing-account');check(count($m->learners($individual['id'],'solo-existing-account',$now))===1);
 rejects(fn()=>$m->invite($individual['id'],'solo-existing-account','extra@example.test','extra@example.test',true,$now),'LEARNER_LIMIT');
 rejects(fn()=>$m->remove($individual['id'],'solo-existing-account','anything',$now),'EMAIL_PERMANENT');
 $family=$owner('family','annual','owner@example.test','stable-trial-owner');check(count($m->learners($family['id'],'stable-trial-owner',$now))===1);
 rejects(fn()=>$m->invite($family['id'],'intruder','a@example.test','a@example.test',true,$now),'MEMBERSHIP_FORBIDDEN');
 rejects(fn()=>$m->invite($family['id'],'stable-trial-owner','a@example.test','b@example.test',true,$now),'EMAIL_CONFIRMATION_REQUIRED');
 rejects(fn()=>$m->invite($family['id'],'stable-trial-owner','a@example.test','a@example.test',false,$now),'PERMANENT_EMAIL_ACK_REQUIRED');
 $familySeats=[];for($i=1;$i<=4;$i++)$familySeats[]=$m->invite($family['id'],'stable-trial-owner',"family$i@example.test","family$i@example.test",true,$now);
 check(count($m->learners($family['id'],'stable-trial-owner',$now))===5);
 check($m->invite($family['id'],'stable-trial-owner','FAMILY1@example.test','family1@example.test',true,$now)['id']===$familySeats[0]['id']);
 rejects(fn()=>$m->invite($family['id'],'stable-trial-owner','fifth@example.test','fifth@example.test',true,$now),'LEARNER_LIMIT');
 rejects(fn()=>$m->remove($family['id'],'stable-trial-owner',$familySeats[0]['id'],$now),'EMAIL_PERMANENT');
 $issuer=new class implements MembershipIssuer {
  public array $grants=[],$revoked=[];public bool $fail=true;
  public function grantMembership(array $r):string {
   check($r['device_policy']==='any_device');$id=$r['member_id'];$this->grants[$id]??=['account'=>'learner_'.hash('sha256',$r['email']),'request'=>$r];
   // Durable issuer grant may succeed before the worker loses its response.
   if($this->fail){$this->fail=false;throw new RuntimeException('SIMULATED_LOST_RESPONSE');}
   return $this->grants[$id]['account'];
  }
  public function revokeMembership(string $id,string $account):void {$this->revoked[$id]=$account;}
 };
 rejects(fn()=>$m->work($issuer,$now),'SIMULATED_LOST_RESPONSE');while($m->work($issuer,$now)){}
 check(count($issuer->grants)===4);check(count(array_unique(array_column($issuer->grants,'account')))===4);
 foreach($m->learners($family['id'],'stable-trial-owner',$now)as $r)check($r['state']==='active');
 $school=$owner('institution','annual','admin@example.test','school-admin');check(count($m->learners($school['id'],'school-admin',$now))===0);
 check($m->policy($school['id'],'school-admin',$now)['max_learners']===500);
 $start=(new DateTimeImmutable('@'.$school['starts_at']))->setTimezone(new DateTimeZone('UTC'));$year=$start->modify('first day of this month')->modify('+12 months');$year=$year->setDate((int)$year->format('Y'),(int)$year->format('m'),min((int)$start->format('d'),(int)$year->format('t')));check((int)$school['expires_at']===$year->getTimestamp());
 rejects(fn()=>$m->invite($school['id'],'school-admin','family1@example.test','family1@example.test',false,$now),'EMAIL_ALREADY_ASSIGNED');
 $students=[];for($i=0;$i<500;$i++)$students[]=$m->invite($school['id'],'school-admin',"student$i@example.test","student$i@example.test",false,$now);
 rejects(fn()=>$m->invite($school['id'],'school-admin','overflow@example.test','overflow@example.test',false,$now),'LEARNER_LIMIT');
 rejects(fn()=>$m->remove($school['id'],'school-admin',$familySeats[0]['id'],$now),'MEMBER_NOT_FOUND');
 $m->remove($school['id'],'school-admin',$students[0]['id'],$now);$m->remove($school['id'],'school-admin',$students[0]['id'],$now);
 rejects(fn()=>$m->invite($school['id'],'school-admin','replacement@example.test','replacement@example.test',false,$now),'LEARNER_LIMIT');
 check($m->work($issuer,$now)===1);check(array_key_exists($students[0]['id'],$issuer->revoked));
 $m->invite($school['id'],'school-admin','replacement@example.test','replacement@example.test',false,$now);while($m->work($issuer,$now)){}
 check(count($m->learners($school['id'],'school-admin',$now))===500);
 check(!isset($issuer->grants[$students[0]['id']]));
 // Active removal revokes the member before freeing the slot and never touches
 // another member or the family owner's stable identity.
 $active=$m->learners($school['id'],'school-admin',$now)[0];$m->remove($school['id'],'school-admin',$active['id'],$now);$m->work($issuer,$now);
 check($issuer->revoked[$active['id']]!==''&&count($m->learners($family['id'],'stable-trial-owner',$now))===5);
 rejects(fn()=>$m->learners($school['id'],'school-admin',(int)$school['expires_at']),'MEMBERSHIP_EXPIRED');
 rejects(fn()=>$m->invite($family['id'],'stable-trial-owner','future@example.test','future@example.test',true,(int)$family['expires_at']),'MEMBERSHIP_EXPIRED');
 check(!str_contains(file_get_contents($root.'/members.sqlite'),'family1@example.test'));
 check((fileperms($root.'/members.sqlite')&0777)===0600);
 echo "PASS: verified paid owners; individual 1, family 5 including owner, institution 500; annual-only institution; fixed family emails and confirmation; account isolation; encrypted emails; idempotent issuer retries; revocation before seat replacement; shared expiry. No production issuer, SMTP or HTTP integration is asserted.\n";
}finally{foreach(glob($root.'/*sqlite*')as $f)unlink($f);rmdir($root.'/public_html');rmdir($root);}
