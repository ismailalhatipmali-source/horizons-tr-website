<?php
declare(strict_types=1);
namespace Horizons;
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/../commerce/TransferCheckout.php';
require_once __DIR__.'/../commerce/MembershipFulfilment.php';
function commerceApplication(array $config):array {
    $config=membershipFeatures($config);if(($config['transfer_sales_enabled']??false)!==true)throw new ServiceError('CHECKOUT_NOT_READY',503);
    [$service,$members,$bridge]=membershipApplication($config);$root=$config['document_root']??dirname(dirname($config['code_path'])).'/public_html';$dir=dirname($config['database_path']);$crypto=new Crypto($config);
    $settings=['charges_enabled'=>true,'price_approved'=>true,'bank_adapter_approved'=>true,'activation_adapter_approved'=>true,'product'=>PRODUCT,'merchant_id'=>'horizons-vakifbank-transfer','terminal_id'=>'owner-confirmed-transfer'];
    $prices=['individual'=>['monthly'=>999,'annual'=>9900,'lifetime'=>15000],'family'=>['monthly'=>2000,'annual'=>20000,'lifetime'=>25000],'institution'=>['annual'=>100000]];
    foreach($prices as $type=>$plans)foreach($plans as $plan=>$amount)$settings['accounts'][$type]['plans'][$plan]=['amount_minor'=>$amount,'currency'=>'USD'];
    $purchases=new \HorizonsCommerce\PurchaseLedger($dir.'/purchases.sqlite',$root,$settings);
    $checkout=new \HorizonsCommerce\TransferCheckout($dir.'/transfer-orders.sqlite',$root,$purchases,hash_hmac('sha256','transfer-checkout-v1',$crypto->dataKey,true),$members);
    return [$checkout,new \HorizonsCommerce\MembershipFulfilment($purchases,$members,$bridge),$service,$members,$bridge,$settings,$purchases];
}
