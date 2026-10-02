<?php
declare(strict_types=1);
namespace HorizonsAdmin;

final class AdminService {
    public function __construct(private readonly AdminStore $admin,private readonly array $config,private readonly string $web){}
    private function stack(array $order):array {
        require_once $this->config['code_path'].'/bootstrap.php';
        require_once $this->config['code_path'].'/../commerce/TransferCheckout.php';
        require_once $this->config['code_path'].'/../commerce/MembershipFulfilment.php';
        [$service,$members,$bridge]=\Horizons\membershipApplication($this->config);$crypto=new \Horizons\Crypto($this->config);$dir=dirname($this->config['database_path']);$d=$order['data'];$offer=$d['offer'];
        $settings=['charges_enabled'=>true,'price_approved'=>true,'bank_adapter_approved'=>true,'activation_adapter_approved'=>true,'product'=>'horizons-arabic-level1','merchant_id'=>'horizons-vakifbank-transfer','terminal_id'=>'owner-confirmed-transfer','accounts'=>[$offer['account_type']=>['plans'=>[$offer['term']=>['currency'=>$d['quote']['currency'],'amount_minor'=>$d['quote']['amount_minor']]]]]];
        $purchases=new \HorizonsCommerce\PurchaseLedger($dir.'/purchases.sqlite',$this->web,$settings);
        $transfer=new \HorizonsCommerce\TransferCheckout($dir.'/transfer-orders.sqlite',$this->web,$purchases,hash_hmac('sha256','transfer-checkout-v1',$crypto->dataKey,true),$members);
        $issuer=new class($bridge,$d['locale']) implements \HorizonsCommerce\RenewableMembershipIssuer {
            public function __construct(private readonly \Horizons\MembershipBridge $bridge,private readonly string $locale){}
            public function grantMembership(array $request):string{return $this->bridge->grantMembership($request+['locale'=>$this->locale]);}
            public function revokeMembership(string $memberId,string $accountId):void{$this->bridge->revokeMembership($memberId,$accountId);}
            public function renewGroup(string $groupId,string $renewalId,string $plan,?int $expiresAt):void{$this->bridge->renewGroup($groupId,$renewalId,$plan,$expiresAt);}
        };
        return [$transfer,new \HorizonsCommerce\MembershipFulfilment($purchases,$members,$issuer),$service,$settings];
    }
    public function fulfil(string $id,string $confirmedEmail,bool $confirmed):array {
        if(!$confirmed)throw new \RuntimeException('ACTIVATION_CONFIRM_REQUIRED');
        $lock=fopen(dirname($this->config['database_path']).'/membership-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new \RuntimeException('WORKER_BUSY');
        try{
            $order=$this->admin->order($id);$d=$order['data'];if(strtolower(trim($confirmedEmail))!==$d['buyer']['email'])throw new \RuntimeException('EMAIL_MISMATCH');
            if($order['status']==='fulfilled')return $order;
            if($order['status']!=='invoice_recorded'||!$d['bank_reference']||!$d['invoice'])throw new \RuntimeException('INVOICE_REQUIRED');
            [$transfer,$fulfilment,,$settings]=$this->stack($order);
            if(!$d['purchase_id']){
                $buyer=$d['buyer'];$buyer['email_confirm']=$buyer['email'];$buyer['postal']='';
                $p=$transfer->create(['request_id'=>substr(hash('sha256','admin:'.$id),0,32),'account_type'=>$d['offer']['account_type'],'plan'=>$d['offer']['term'],'terms_accepted'=>true,'permanent_acknowledged'=>true,'buyer'=>$buyer],'owner-admin',time());
                $order['data']['purchase_id']=$p['order_id'];$this->admin->save($order);
            }
            $pid=$order['data']['purchase_id'];$transfer->confirm($pid,$d['bank_reference'],$d['quote']['currency'],$d['quote']['amount_minor'],$settings);
            $group=$fulfilment->fulfil($pid);$order['data']['group_id']=$group['id'];$order['data']['account_id']=$group['owner_account'];$order['status']='fulfilled';$this->admin->save($order);$this->admin->event('membership_issued',$id);
            // Existing scheduled worker delivers the queued code. No SMTP settings change.
            return $order;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public function resend(string $id):array {
        $order=$this->admin->order($id);if($order['status']!=='fulfilled')throw new \RuntimeException('ACTIVATION_REQUIRED');
        [,,$service]=$this->stack($order);$service->resend(['email'=>$order['data']['buyer']['email']],'owner-admin');$this->admin->event('activation_requeued',$id);return ['queued'=>true];
    }
    public function customers(int $page=0):array {
        require_once $this->config['code_path'].'/Core.php';$crypto=new \Horizons\Crypto($this->config);
        $path=$this->config['database_path'];$db=new \PDO('sqlite:'.$path,null,null,[\PDO::SQLITE_ATTR_OPEN_FLAGS=>\PDO::SQLITE_OPEN_READONLY]);$db->exec('PRAGMA query_only=ON');
        $q=$db->prepare('SELECT r.email_cipher,r.account_type,r.plan,r.starts_at,r.expires_at,r.revoked,d.state AS delivery_state FROM membership_rights r LEFT JOIN membership_delivery d ON d.member_id=r.member_id ORDER BY r.created_at DESC,r.member_id LIMIT 31 OFFSET ?');$q->execute([max(0,min(10000,$page))*30]);$rows=$q->fetchAll(\PDO::FETCH_ASSOC);$more=count($rows)>30;
        $out=[];foreach(array_slice($rows,0,30) as $r){$r['email']=$crypto->open($r['email_cipher']);unset($r['email_cipher']);$out[]=$r;}return ['customers'=>$out,'more'=>$more,'page'=>$page];
    }
}
