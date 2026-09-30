<?php
declare(strict_types=1);
require __DIR__.'/../src/commerce/PurchaseLedger.php';
use HorizonsCommerce\PurchaseLedger;
use HorizonsCommerce\BankVerifier;
function check(bool $ok): void { if (!$ok) throw new RuntimeException('ASSERTION_FAILED'); }
function rejects(callable $fn, string $message): void {
    try {$fn();} catch (RuntimeException $e) {check($e->getMessage()===$message);return;}
    throw new RuntimeException('EXPECTED_REJECTION');
}
$root=sys_get_temp_dir().'/hzn-ledger-'.bin2hex(random_bytes(6));
mkdir($root,0700);mkdir($root.'/public_html',0700);
$settings=['charges_enabled'=>true,'price_approved'=>true,'bank_adapter_approved'=>true,'activation_adapter_approved'=>true,'product'=>'horizons-arabic-level1','max_devices'=>3,'merchant_id'=>'fake-merchant','terminal_id'=>'fake-terminal','plans'=>['annual'=>['amount_minor'=>9900,'currency'=>'USD']]];
try {
 rejects(fn()=>new PurchaseLedger($root.'/public_html/buyers.sqlite',$root.'/public_html',$settings),'PRIVATE_DATABASE_REQUIRED');
 $off=$settings;$off['charges_enabled']=false;
 $disabled=new PurchaseLedger($root.'/disabled.sqlite',$root.'/public_html',$off);
 rejects(fn()=>$disabled->create('test@example.com','annual'),'CHECKOUT_NOT_READY');
 $ledger=new PurchaseLedger($root.'/purchases.sqlite',$root.'/public_html',$settings);
 $order=$ledger->create('test@example.com','annual');
 rejects(fn()=>$ledger->markAccessGranted($order['order_id'],'stable-account'),'PAYMENT_REQUIRED');
 $bank=new class implements BankVerifier {
  public array $receipt=[];
  public function querySale(string $transactionId): array {return $this->receipt;}
 };
 $bank->receipt=['status'=>'sale_confirmed','merchant_id'=>'fake-merchant','terminal_id'=>'fake-terminal','order_id'=>$order['order_id'],'transaction_id'=>$order['transaction_id'],'currency'=>'USD','amount_minor'=>9900];
 foreach(['status'=>'authenticated','amount_minor'=>9901,'currency'=>'TRY','merchant_id'=>'other','transaction_id'=>'other','order_id'=>'other','terminal_id'=>'other'] as $key=>$bad) {
  $good=$bank->receipt[$key];$bank->receipt[$key]=$bad;
  rejects(fn()=>$ledger->confirm($order['order_id'],$bank),'BANK_SALE_MISMATCH');
  check($ledger->order($order['order_id'])['status']==='pending');$bank->receipt[$key]=$good;
 }
 $ledger->confirm($order['order_id'],$bank);$ledger->confirm($order['order_id'],$bank);
 check(count($ledger->jobs($order['order_id']))===1);
 $ledger->markAccessGranted($order['order_id'],'stable-account');$ledger->markAccessGranted($order['order_id'],'stable-account');
 check(count($ledger->jobs($order['order_id']))===2);
 rejects(fn()=>$ledger->markAccessGranted($order['order_id'],'different-account'),'ACCOUNT_MISMATCH');
 check($ledger->order($order['order_id'])['status']==='access_ready');
 echo "PASS: private storage, collection gates, verified amount/currency/order/merchant, payment before access, idempotent grant and mail jobs\n";
} finally {foreach(glob($root.'/*.sqlite') as $file) unlink($file);rmdir($root.'/public_html');rmdir($root);}
