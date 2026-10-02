<?php
declare(strict_types=1);
namespace HorizonsCheckout;

final class ManualOrderNotifier {
    public function __construct(private readonly ManualOrderMailer $mailer, private readonly array $catalog, private readonly array $locales) {}
    public function notify(array $order, ManualOrders $orders, bool $testOnly=false): void {
        $buyer=$order['buyer'];$product=$order['product'];$offer=$order['offer'];
        $amount=number_format(((int)$offer['price_minor'])/100,2,'.','').' '.$offer['currency'];
        $prefix=$testOnly?'[TEST — NO SALE / NO PAYMENT] ':'';
        $testNote=$testOnly?"INTERNAL DELIVERY TEST. This is not a customer order, sale, payment request or download entitlement.\n\n":'';
        if(!$order['owner_notified']){
            $owner=$this->catalog['seller']['email']??'info@horizons-tr.com';
            $body=$testNote."HORIZONS — Manual order request\n\nReference: ".$order['reference']."\nProduct: ".$product['name']."\nOffer: ".($offer['label']??$offer['id'])."\nTotal: ".$amount."\n\nCustomer: ".$buyer['first_name'].' '.$buyer['last_name']."\nEmail: ".$buyer['email']."\nPhone: ".$buyer['phone']."\nCountry: ".$buyer['country']."\nCity: ".$buyer['city']."\nInvoice: ".$buyer['billing']."\n";
            if(($buyer['billing']??'')==='company')$body.="Company: ".($buyer['company_name']??'')."\nTax ID: ".($buyer['tax_id']??'')."\nTax office: ".($buyer['tax_office']??'')."\n";
            $body.="\nNo payment was collected on the website. Verify payment manually before sending any activation code or download link. Reply directly to the customer from this email thread.\n";
            $this->mailer->send($owner,$prefix.'HORIZONS — New manual order '.$order['reference'],$body,$buyer['email']);
            $orders->mark($order['reference'],'owner_notified');
        }
        if(!$order['buyer_notified']){
            $t=$this->locales[$order['locale']]??$this->locales['en']??[];
            $subject=$t['saved']??'Your order request was received.';
            $intro=$t['order_note']??'No payment was charged. HORIZONS will confirm payment and send the download link manually after verification.';
            $name=$t['product_title']??$product['name'];
            $body=$testNote.$subject."\n\n".$intro."\n\n".($t['reference']??'Order reference').": ".$order['reference']."\n".($t['product']??'Product').": ".$name."\n".($t['total']??'Total').": ".$amount."\n\nsupport@horizons-tr.com\n";
            $this->mailer->send($buyer['email'],$prefix.'HORIZONS — '.$name.' · '.$order['reference'],$body);
            $orders->mark($order['reference'],'buyer_notified');
        }
    }
}
