<?php
declare(strict_types=1);
namespace HorizonsCheckout;

/** Informational conversions of published product prices, never settlement quotes. */
final class DisplayExchangeRates {
    private const URL = 'https://open.er-api.com/v6/latest/USD';
    public function __construct(private readonly string $dir, private readonly array $currencies, private readonly ?\Closure $fetcher = null) {}

    private function fetch(): array {
        if ($this->fetcher) $body = ($this->fetcher)(self::URL);
        else {
            $body = ''; $ch = curl_init(self::URL);
            curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION=>false, CURLOPT_CONNECTTIMEOUT=>4, CURLOPT_TIMEOUT=>8,
                CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
                CURLOPT_USERAGENT=>'HORIZONS indicative product prices/1.0',
                CURLOPT_WRITEFUNCTION=>static function($handle, $chunk) use (&$body) {
                    if (strlen($body)+strlen($chunk)>100000) return 0;
                    $body .= $chunk; return strlen($chunk);
                }]);
            $ok = curl_exec($ch); $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
            if ($ok===false || $status!==200) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        }
        return json_decode($body, true, 8, JSON_THROW_ON_ERROR);
    }

    private function validate(array $data, int $now): array {
        $updated = $data['time_last_update_unix'] ?? null;
        if (($data['result']??'')!=='success' || ($data['base_code']??'')!=='USD'
            || !is_int($updated) || $updated>$now+300 || $now-$updated>72*3600
            || !is_array($data['rates']??null) || count($data['rates'])<100
            || (float)($data['rates']['USD']??0)!==1.0) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        foreach ($data['rates'] as $code=>$rate) {
            if (!preg_match('/^[A-Z]{3}$/D', $code) || (!is_int($rate)&&!is_float($rate))
                || !is_finite((float)$rate) || $rate<=0 || $rate>100000000) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        }
        return $data;
    }

    private function rates(int $now): array {
        $path = $this->dir.'/display-fx-cache.json'; $cached = null;
        if (is_link($path)) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        if (is_file($path)) try { $cached=$this->validate(json_decode(file_get_contents($path),true,8,JSON_THROW_ON_ERROR),$now); } catch (\Throwable) {}
        // At most one upstream fetch per hour; cache through the provider's next daily update.
        if ($cached && $now<max(($cached['_fetched_at']??0)+3600, min((int)($cached['time_next_update_unix']??0),($cached['_fetched_at']??0)+86400))) return $cached;
        $lockPath=$this->dir.'/display-fx.lock'; $retryPath=$this->dir.'/display-fx-retry.json';
        if (is_link($lockPath)||is_link($retryPath)) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        $lock=fopen($lockPath,'c'); if (!$lock) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        try {
            if (!flock($lock,LOCK_EX|LOCK_NB)) { if ($cached) return $cached; throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE'); }
            $retry=is_file($retryPath)?json_decode(file_get_contents($retryPath),true):null;
            if (($retry['after']??0)>$now) { if ($cached) return $cached; throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE'); }
            try {
                $data=$this->validate($this->fetch(),$now); $data['_fetched_at']=$now;
                $temp=$path.'.'.bin2hex(random_bytes(6));
                try {
                    if (file_put_contents($temp,json_encode($data,JSON_THROW_ON_ERROR))===false || !chmod($temp,0600) || !rename($temp,$path)) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
                } finally { if (is_file($temp)) unlink($temp); }
                return $data;
            } catch (\Throwable) {
                file_put_contents($retryPath,json_encode(['after'=>$now+3600])); chmod($retryPath,0600);
                if ($cached) return $cached; throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
            }
        } finally { flock($lock,LOCK_UN); fclose($lock); }
    }

    public function estimate(array $catalog,string $product,string $offerId,string $currency,int $now,?array $settlement=null): array {
        $p=$catalog['products'][$product]??null; $offer=null;
        if (($p['available']??false)!==true) throw new \RuntimeException('PRODUCT_UNAVAILABLE');
        foreach ($p['offers'] as $o) if ($o['id']===$offerId) $offer=$o;
        if (!$offer || $offer['currency']!=='USD' || !isset($this->currencies[$currency])) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        $from=$settlement['currency']??'USD'; $minor=$settlement['amount_minor']??$offer['price_minor'];
        if (!in_array($from,['USD','TRY','EUR'],true) || !is_int($minor) || $minor<=0) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        $digits=$this->currencies[$currency]['digits'];
        if (!is_int($digits)||$digits<0||$digits>4) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        $updated=null;
        if ($from===$currency) $amount=$minor/100;
        else {
            $data=$this->rates($now);
            if (!isset($data['rates'][$currency],$data['rates'][$from])) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
            $amount=($minor/100)*($data['rates'][$currency]/$data['rates'][$from]); $updated=$data['time_last_update_unix'];
        }
        $displayMinor=round($amount*(10**$digits));
        if (!is_finite($displayMinor)||$displayMinor<0||$displayMinor>9007199254740991) throw new \RuntimeException('DISPLAY_FX_UNAVAILABLE');
        return ['product'=>$product,'offer'=>$offerId,'currency'=>$currency,'amount_minor'=>(int)$displayMinor,'digits'=>$digits,
            'based_on_currency'=>$from,'based_on_minor'=>$minor,'base_minor'=>$offer['price_minor'],
            'rate_updated_at'=>$updated,'indicative'=>true,'settlement_allowed'=>false,'source'=>$updated===null?'catalog_or_quote':'ExchangeRate-API'];
    }
}
