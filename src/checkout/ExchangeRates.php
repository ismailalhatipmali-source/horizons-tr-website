<?php
declare(strict_types=1);
namespace HorizonsCheckout;

/** Public reference feeds only. Never sends buyer information to a rate provider. */
final class ExchangeRates {
    public function __construct(private readonly string $dir,private readonly string $key,private readonly int $marginBps=300,private readonly ?\Closure $fetcher=null) {
        if(strlen($key)!==32||$marginBps<0||$marginBps>1000)throw new \RuntimeException('FX_CONFIGURATION');
    }
    private function get(string $url):string {
        if($this->fetcher)return ($this->fetcher)($url);
        $body='';$ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>8,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'HORIZONS exchange-rate cache/1.0',CURLOPT_WRITEFUNCTION=>static function($h,$s)use(&$body){if(strlen($body)+strlen($s)>100000)return 0;$body.=$s;return strlen($s);}]);
        $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        if($ok===false||$status!==200)throw new \RuntimeException('FX_UNAVAILABLE');return $body;
    }
    private function date(string $date,int $now):void {
        if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||!($time=strtotime($date.'T00:00:00Z'))||$time>$now+86400||$now-$time>5*86400)throw new \RuntimeException('FX_STALE');
    }
    private function validate(array $data,int $now):array {
        $this->date($data['date']??'',$now);
        foreach(['TRY','EUR'] as $c)if(!is_numeric($data['rates'][$c]??null)||!is_finite((float)$data['rates'][$c])||$data['rates'][$c]<=0||$data['rates'][$c]>1000000)throw new \RuntimeException('FX_INVALID');
        if(!in_array($data['source']??'',['TCMB Forex selling/buying','ECB via Frankfurter'],true))throw new \RuntimeException('FX_INVALID');return $data;
    }
    public function parseTcmb(string $xml,int $now):array {
        if(stripos($xml,'<!DOCTYPE')!==false||stripos($xml,'<!ENTITY')!==false)throw new \RuntimeException('FX_INVALID');
        $old=libxml_use_internal_errors(true);try{$r=simplexml_load_string($xml,'SimpleXMLElement',LIBXML_NONET);}finally{libxml_clear_errors();libxml_use_internal_errors($old);}
        if(!$r)throw new \RuntimeException('FX_INVALID');$date=\DateTimeImmutable::createFromFormat('!m/d/Y',(string)$r['Date']);if(!$date)throw new \RuntimeException('FX_INVALID');
        $rates=[];foreach($r->Currency as $row){$code=(string)$row['CurrencyCode'];if(!in_array($code,['USD','EUR'],true))continue;$unit=(float)$row->Unit;if($unit<=0)throw new \RuntimeException('FX_INVALID');$rates[$code]=['buy'=>(float)$row->ForexBuying/$unit,'sell'=>(float)$row->ForexSelling/$unit];}
        if(($rates['EUR']['buy']??0)<=0||($rates['USD']['sell']??0)<=0)throw new \RuntimeException('FX_INVALID');
        return $this->validate(['date'=>$date->format('Y-m-d'),'source'=>'TCMB Forex selling/buying','rates'=>['USD'=>1,'TRY'=>$rates['USD']['sell'],'EUR'=>$rates['USD']['sell']/$rates['EUR']['buy']],'fetched_at'=>$now],$now);
    }
    public function rates(int $now):array {
        $path=$this->dir.'/fx-cache.json';$cached=null;
        if(is_file($path)&&!is_link($path)){try{$cached=$this->validate(json_decode(file_get_contents($path),true,8,JSON_THROW_ON_ERROR),$now);if($now-($cached['fetched_at']??0)<1800)return $cached;}catch(\Throwable){}}
        $lock=fopen($this->dir.'/fx.lock','c');if(!$lock)throw new \RuntimeException('FX_UNAVAILABLE');
        try{if(!flock($lock,LOCK_EX|LOCK_NB)){if($cached)return $cached;throw new \RuntimeException('FX_UNAVAILABLE');}
            try{$data=$this->parseTcmb($this->get('https://www.tcmb.gov.tr/kurlar/today.xml'),$now);}
            catch(\Throwable){try{$rows=json_decode($this->get('https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=TRY,EUR'),true,8,JSON_THROW_ON_ERROR);$data=['source'=>'ECB via Frankfurter','rates'=>['USD'=>1],'date'=>'','fetched_at'=>$now];foreach($rows as $r){if(($r['base']??'')!=='USD'||!in_array($r['quote']??'',['TRY','EUR'],true))continue;if($data['date']!==''&&$data['date']!==$r['date'])throw new \RuntimeException('FX_INVALID');$data['date']=$r['date'];$data['rates'][$r['quote']]=$r['rate'];}$data=$this->validate($data,$now);}catch(\Throwable){if($cached)return $cached;throw new \RuntimeException('FX_UNAVAILABLE');}}
            $tmp=$path.'.'.bin2hex(random_bytes(6));if(file_put_contents($tmp,json_encode($data,JSON_THROW_ON_ERROR))===false)throw new \RuntimeException('FX_UNAVAILABLE');chmod($tmp,0600);rename($tmp,$path);return $data;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public function quote(array $catalog,string $product,string $offerId,string $currency,int $now):array {
        $p=$catalog['products'][$product]??null;$offer=null;if(($p['available']??false)!==true)throw new \RuntimeException('PRODUCT_UNAVAILABLE');foreach($p['offers'] as $o)if($o['id']===$offerId)$offer=$o;
        if(!$offer||$offer['currency']!=='USD'||!in_array($currency,['USD','TRY','EUR'],true))throw new \RuntimeException('FX_INVALID');
        $data=$currency==='USD'?['date'=>gmdate('Y-m-d',$now),'source'=>'USD catalog','rates'=>['USD'=>1]]:$this->rates($now);
        $margin=$currency==='USD'?0:$this->marginBps;$scale=100000000;$scaled=(int)round($data['rates'][$currency]*$scale);$productAmount=$offer['price_minor']*$scaled;
        if(!is_int($productAmount)||$productAmount<=0)throw new \RuntimeException('FX_INVALID');
        // Divide before multiplying the margin to avoid overflow as rates rise.
        $factor=10000+$margin;$whole=intdiv($productAmount,$scale)*$factor;
        if(!is_int($whole))throw new \RuntimeException('FX_INVALID');
        $fraction=($whole%10000)*$scale+($productAmount%$scale)*$factor;$denominator=$scale*10000;
        $minor=intdiv($whole,10000)+intdiv($fraction,$denominator)+($fraction%$denominator?1:0);
        $q=['product'=>$product,'offer'=>$offerId,'base_currency'=>'USD','base_minor'=>$offer['price_minor'],'currency'=>$currency,'amount_minor'=>$minor,'reference_rate'=>$scaled/100000000,'margin_bps'=>$margin,'source'=>$data['source'],'rate_date'=>$data['date'],'issued_at'=>$now,'expires_at'=>$now+900];
        $payload=rtrim(strtr(base64_encode(json_encode($q,JSON_THROW_ON_ERROR)),'+/','-_'),'=');$q['token']=$payload.'.'.hash_hmac('sha256','fx-v1:'.$payload,$this->key);return $q;
    }
    public function verify(string $token,string $product,array $offer,int $now):array {
        if(strlen($token)>3000||count($parts=explode('.',$token))!==2||!hash_equals(hash_hmac('sha256','fx-v1:'.$parts[0],$this->key),$parts[1]))throw new \RuntimeException('FX_INVALID');
        $q=json_decode(base64_decode(strtr($parts[0],'-_','+/'),true)?:'',true,8,JSON_THROW_ON_ERROR);
        if(($q['product']??'')!==$product||($q['offer']??'')!==$offer['id']||($q['base_minor']??null)!==$offer['price_minor']||($q['base_currency']??'')!=='USD'||!in_array($q['currency']??'',['USD','TRY','EUR'],true)||!is_int($q['amount_minor']??null)||$q['amount_minor']<=0||($q['expires_at']??0)<=$now||($q['issued_at']??PHP_INT_MAX)>$now)throw new \RuntimeException('FX_EXPIRED');return $q;
    }
}
