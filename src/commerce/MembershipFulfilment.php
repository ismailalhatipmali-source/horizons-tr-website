<?php
declare(strict_types=1);
namespace HorizonsCommerce;
require_once __DIR__.'/PurchaseLedger.php';
require_once __DIR__.'/MembershipLedger.php';
final class MembershipFulfilment {
    public function __construct(private readonly PurchaseLedger $purchases,private readonly MembershipLedger $members,private readonly MembershipIssuer $issuer){}
    public function fulfil(string $orderId):array {
        $order=$this->purchases->order($orderId);
        if(!in_array($order['status'],['paid','access_ready'],true)||!is_string($order['paid_at']))throw new \RuntimeException('PAYMENT_REQUIRED');
        $existing=$this->purchases->existingAccount($order['email']);
        if($existing&&$this->issuer instanceof RenewableMembershipIssuer){
            $original=$this->members->ownerGroup($existing,$order['account_type']);
            if($original&&$original['order_id']!==$orderId){$group=$this->members->renewOwner($orderId,$this->purchases,$existing,$this->issuer);if($group){$this->purchases->markAccessGranted($orderId,$existing);$this->purchases->markFulfilled($orderId);return $group;}}
        }
        $start=strtotime($order['paid_at']);if($start===false)throw new \RuntimeException('ORDER_INVALID');$end=null;
        if($order['plan']!=='lifetime'){$d=(new \DateTimeImmutable('@'.$start))->setTimezone(new \DateTimeZone('UTC'));$next=$d->modify('first day of this month')->modify('+'.($order['plan']==='annual'?12:1).' months');$end=$next->setDate((int)$next->format('Y'),(int)$next->format('m'),min((int)$d->format('d'),(int)$next->format('t')))->getTimestamp();}
        $account=$this->issuer->grantMembership(['member_id'=>'own_'.hash('sha256',$orderId),'group_id'=>'grp_'.hash('sha256',$orderId),'account_type'=>$order['account_type'],'plan'=>$order['plan'],'email'=>$order['email'],'starts_at'=>$start,'expires_at'=>$end,'device_policy'=>'any_device']);
        $this->purchases->markAccessGranted($orderId,$account);$group=$this->members->fulfilOwner($orderId,$this->purchases);$this->purchases->markFulfilled($orderId);return $group;
    }
}
