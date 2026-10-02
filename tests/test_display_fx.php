<?php
declare(strict_types=1);
require __DIR__.'/../src/checkout/DisplayExchangeRates.php';
require __DIR__.'/../src/checkout/ExchangeRates.php';
use HorizonsCheckout\DisplayExchangeRates;
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
function rejects(Closure $fn):void { try{$fn();}catch(RuntimeException){return;}throw new RuntimeException('Expected rejection'); }
$dir=sys_get_temp_dir().'/hzn-display-'.bin2hex(random_bytes(8));mkdir($dir,0700);
try {
 $meta=json_decode(file_get_contents(__DIR__.'/../src/commerce/display-currencies.json'),true);
 $catalog=json_decode(file_get_contents(__DIR__.'/../src/commerce/products.json'),true);$now=strtotime('2026-10-02T14:00:00Z');
 $rates=array_fill_keys(array_keys($meta['currencies']),1);unset($rates['KPW']);
 $rates=array_replace($rates,['USD'=>1,'SAR'=>3.75,'AED'=>3.6725,'TRY'=>49.03,'EUR'=>0.886,'CNY'=>7.11,'JPY'=>146.99,'KWD'=>0.3065,'BHD'=>0.376,'JOD'=>0.709,'IDR'=>15001.55,'KRW'=>1345.11,'IRR'=>42001,'VND'=>25001]);
 $body=['result'=>'success','base_code'=>'USD','time_last_update_unix'=>$now-3600,'time_next_update_unix'=>$now+23*3600,'rates'=>$rates];$calls=0;
 $fetch=function($url)use(&$calls,&$body){check($url==='https://open.er-api.com/v6/latest/USD','fixed upstream URL');$calls++;return json_encode($body);};
 $fx=new DisplayExchangeRates($dir,$meta['currencies'],$fetch);
 $q=fn($c,$n=null,$settlement=null)=>$fx->estimate($catalog,'horizons-arabic-level1','individual-monthly',$c,$n??$now,$settlement);
 foreach(['SA'=>'SAR','TR'=>'TRY','CN'=>'CNY','AE'=>'AED','JP'=>'JPY','KW'=>'KWD','IN'=>'INR','PK'=>'PKR','BD'=>'BDT','ID'=>'IDR','MY'=>'MYR','SG'=>'SGD','KR'=>'KRW','BG'=>'EUR','ZW'=>'ZWG'] as $country=>$currency)check($meta['countries'][$country][0]===$currency,'country mapping '.$country);
 check($q('USD')['amount_minor']===999 && $calls===0,'USD needs no external feed');
 foreach(['SAR'=>3746,'CNY'=>7103,'JPY'=>1468,'KWD'=>3062,'BHD'=>3756,'JOD'=>7083] as $c=>$minor){$r=$q($c);check($r['amount_minor']===$minor,'rounding '.$c);check($r['indicative']===true && $r['settlement_allowed']===false,'display-only flag');}
 check($q('JPY')['digits']===0&&$q('KWD')['digits']===3,'currency precision');check($calls===1,'daily shared cache');
 // Estimate the already marked-up, signed transaction amount: never apply margin twice.
 $quote=['currency'=>'TRY','amount_minor'=>50450];$r=$q('SAR',null,$quote);check($r['amount_minor']===(int)round((504.50/49.03)*3.75*100),'cross-currency amount');check($r['based_on_minor']===50450,'quote amount preserved');
 $r=$q('TRY',null,$quote);check($r['amount_minor']===50450,'same currency exact');
 rejects(fn()=>$q('KPW'));rejects(fn()=>$q('ZZZ'));rejects(fn()=>$fx->estimate($catalog,'made-up','individual-monthly','SAR',$now));
 $fail=new DisplayExchangeRates($dir,$meta['currencies'],static function(){throw new RuntimeException('offline');});
 check($fail->estimate($catalog,'horizons-arabic-level1','individual-monthly','CNY',$now+86400)['amount_minor']===7103,'bounded last known cache');
 rejects(fn()=>$fail->estimate($catalog,'horizons-arabic-level1','individual-monthly','CNY',$now+4*86400));
 foreach(glob($dir.'/*') as $file)unlink($file);
 $body['rates']['CNY']=-1;rejects(fn()=>$q('CNY'));check(!is_file($dir.'/display-fx-cache.json'),'bad feed not cached');
 foreach(glob($dir.'/*') as $file)unlink($file);
 $body['rates']['CNY']=7.11;$body['time_last_update_unix']=$now+3600;rejects(fn()=>$q('CNY'));
 // Existing payment verifier never accepts a display estimate or an unsupported settlement currency.
 $payment=new HorizonsCheckout\ExchangeRates($dir,str_repeat('k',32));rejects(fn()=>$payment->quote($catalog,'horizons-arabic-level1','individual-monthly','SAR',$now));
 rejects(fn()=>$payment->verify(json_encode($r),'horizons-arabic-level1',$catalog['products']['horizons-arabic-level1']['offers'][0],$now));
 echo "PASS: country mappings, 0/2/3 decimals, bounded cache and outages, no duplicated margin, display cannot authorize settlement.\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
