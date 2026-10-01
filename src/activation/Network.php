<?php
declare(strict_types=1);
namespace Horizons;

/** Explicit disabled adapter for isolated owner-only validation; never grants paid rights. */
final class DisabledPurchases implements Purchases {
    public function find(string $purchaseEmail): ?array { return null; }
    public function byId(string $saleId): ?array { throw new ServiceError('SERVICE_UNAVAILABLE', 503); }
}

final class Gumroad implements Purchases {
    private readonly string $token;
    private readonly string $productId;
    private readonly string $sellerId;
    public function __construct(array $config) {
        $this->token = trim($config['gumroad_access_token'] ?? '');
        $this->productId = trim($config['gumroad_product_id'] ?? '');
        $this->sellerId = trim($config['gumroad_seller_id'] ?? '');
        foreach ([$this->token, $this->productId, $this->sellerId] as $v) if ($v === '' || str_contains($v, 'REPLACE') || preg_match('/[\r\n]/', $v)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    private function api(string $path, array $params, bool $post = false, bool $auth = true): array {
        // Fixed origin and trusted route construction; never follow a webhook or API supplied URL.
        $url = 'https://api.gumroad.com/v2/' . $path;
        if (!$post) $url .= '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
        $ch = curl_init($url);
        $headers = ['Accept: application/json'];
        if ($auth) $headers[] = 'Authorization: Bearer ' . $this->token;
        $body = '';
        curl_setopt_array($ch, [CURLOPT_HTTPHEADER => $headers, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 25, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int { if (strlen($body) + strlen($chunk) > 2 * 1024 * 1024) return 0; $body .= $chunk; return strlen($chunk); }]);
        if ($post) curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($params, '', '&', PHP_QUERY_RFC3986)]);
        $result = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($result === false || $status === 429 || $status >= 500 || $status === 401 || $status === 403) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        try { $data = json_decode($body, true, 24, JSON_THROW_ON_ERROR); }
        catch (\Throwable $e) { throw new ServiceError('SERVICE_UNAVAILABLE', 503); }
        if (!is_array($data)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        if ($status === 404) return ['success' => false];
        if ($status < 200 || $status >= 300 || ($data['success'] ?? false) !== true) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        return $data;
    }
    private function eligible(array $s): bool {
        return ($s['product_id'] ?? '') === $this->productId && ($s['seller_id'] ?? '') === $this->sellerId
            && ($s['paid'] ?? false) === true && is_int($s['price'] ?? null) && $s['price'] > 0
            && ($s['refunded'] ?? true) === false && ($s['chargedback'] ?? true) === false
            && !(($s['disputed'] ?? false) && !($s['dispute_won'] ?? false))
            && !($s['access_revoked'] ?? $s['is_access_revoked'] ?? false)
            && !($s['is_preorder_authorization'] ?? false) && !($s['is_recurring_billing'] ?? false)
            && !($s['test'] ?? false) && ($s['purchaser_id'] ?? null) !== $this->sellerId
            && !($s['is_gift_sender_purchase'] ?? false) && !($s['is_gift_receiver_purchase'] ?? false);
    }
    private function verified(array $sale): ?array {
        if (!$this->eligible($sale) || !is_string($sale['purchase_email'] ?? null) || !is_string($sale['id'] ?? null) || !is_string($sale['license_key'] ?? null)) return null;
        try { $email = email($sale['purchase_email']); } catch (ServiceError $e) { return null; }
        $check = $this->api('licenses/verify', ['product_id' => $this->productId, 'license_key' => $sale['license_key'], 'increment_uses_count' => 'false'], true, false);
        $p = $check['purchase'] ?? [];
        if (($check['success'] ?? false) !== true || !is_array($p) || ($p['product_id'] ?? '') !== $this->productId || ($p['seller_id'] ?? '') !== $this->sellerId
            || ($p['sale_id'] ?? $p['id'] ?? '') !== $sale['id'] || ($p['refunded'] ?? true) !== false || ($p['chargebacked'] ?? true) !== false
            || (($p['disputed'] ?? false) && !($p['dispute_won'] ?? false)) || ($p['test'] ?? false)
            || !is_string($p['email'] ?? null) || strtolower(trim($p['email'])) !== $email) return null;
        // This adapter verifies ONE-TIME sales only. Recurring billing requires a separate
        // provider adapter with authenticated current period start/end; never guess a renewal.
        if (!is_string($sale['created_at'] ?? null)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        try { $created = new \DateTimeImmutable($sale['created_at']); }
        catch (\Throwable $e) { throw new ServiceError('SERVICE_UNAVAILABLE', 503); }
        return ['sale_id'=>$sale['id'], 'email'=>$email, 'verified'=>true, 'product'=>PRODUCT,
            'plan'=>'lifetime', 'channel'=>'direct', 'starts_at'=>utc($created->getTimestamp()),
            'expires_at'=>null, 'legacy_one_time'=>true];
    }
    public function find(string $purchaseEmail): ?array {
        $args = ['email' => $purchaseEmail, 'product_id' => $this->productId];
        for ($page = 0; $page < 20; $page++) {
            $r = $this->api('sales', $args);
            if (!is_array($r['sales'] ?? null)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
            foreach ($r['sales'] as $sale) {
                if (!is_array($sale) || !is_string($sale['purchase_email'] ?? null) || strtolower(trim($sale['purchase_email'])) !== $purchaseEmail) continue;
                $verified = $this->verified($sale);
                if ($verified) return $verified;
            }
            $next = $r['next_page_key'] ?? null;
            if (!$next) return null;
            if (!is_string($next) || strlen($next) > 1024) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
            $args['page_key'] = $next;
        }
        throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    public function byId(string $saleId): ?array {
        if (!preg_match('/^[A-Za-z0-9_+=\/-]{1,120}$/D', $saleId)) throw new ServiceError('INVALID_REQUEST');
        $r = $this->api('sales/' . rawurlencode($saleId), []);
        if (($r['success'] ?? false) !== true) return null;
        if (!is_array($r['sale'] ?? null) || ($r['sale']['id'] ?? '') !== $saleId) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        return $this->verified($r['sale']);
    }
}

final class SmtpMailer implements Mailer {
    public function __construct(private readonly array $config) {}
    private function subject(string $text): string {
        // RFC 2047 encoded words are at most 75 characters and must not split UTF-8.
        $chunks = []; $part = '';
        foreach (preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) as $char) {
            if (strlen($part . $char) > 45) { $chunks[] = $part; $part = ''; }
            $part .= $char;
        }
        if ($part !== '') $chunks[] = $part;
        return implode("\r\n ", array_map(static fn(string $chunk): string => '=?UTF-8?B?' . base64_encode($chunk) . '?=', $chunks));
    }
    private function reply($stream, array $allowed): void {
        $count = 0;
        do {
            $line = fgets($stream, 2048);
            if ($line === false || ++$count > 100 || !preg_match('/^([0-9]{3})([ -])/', $line, $m)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        } while ($m[2] === '-');
        if (!in_array((int)$m[1], $allowed, true)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    private function send($stream, string $value): void {
        while ($value !== '') {
            $n = fwrite($stream, $value);
            if (!$n) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
            $value = substr($value, $n);
        }
    }
    private function command($stream, string $value, array $expected): void { $this->send($stream, $value . "\r\n"); $this->reply($stream, $expected); }
    public function code(string $email, string $code, string $locale): void {
        $c = $this->config;
        $host = $c['host'] ?? '';
        $port = (int)($c['port'] ?? 0);
        $mode = $c['security'] ?? '';
        // Explicit SMTP client identity. Keep the previous domain as the default.
        // Read only private configuration; never trust an HTTP Host header here.
        $ehloDomain = $c['mail_ehlo_domain'] ?? 'horizons-tr.com';
        if (!is_string($ehloDomain) || strlen($ehloDomain) > 253
            || !str_contains($ehloDomain, '.') || str_ends_with($ehloDomain, '.')
            || filter_var($ehloDomain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false
            || filter_var($ehloDomain, FILTER_VALIDATE_IP) !== false) {
            throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        }
        if (!preg_match('/^[a-zA-Z0-9.-]+$/D', $host) || !in_array($mode, ['tls', 'starttls'], true) || $port < 1 || $port > 65535) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $from = email($c['from'] ?? '');
        if (empty($c['username']) || empty($c['password'])) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false, 'peer_name' => $host, 'SNI_enabled' => true, 'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT]]);
        $stream = @stream_socket_client(($mode === 'tls' ? 'tls' : 'tcp') . '://' . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if ($stream === false) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
        stream_set_timeout($stream, 15);
        try {
            $this->reply($stream, [220]);
            $this->command($stream, 'EHLO ' . $ehloDomain, [250]);
            if ($mode === 'starttls') {
                $this->command($stream, 'STARTTLS', [220]);
                if (stream_socket_enable_crypto($stream, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT) !== true) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
                $this->command($stream, 'EHLO ' . $ehloDomain, [250]);
            }
            $this->command($stream, 'AUTH LOGIN', [334]);
            $this->command($stream, base64_encode($c['username']), [334]);
            $this->command($stream, base64_encode($c['password']), [235]);
            $this->command($stream, 'MAIL FROM:<' . $from . '>', [250]);
            $this->command($stream, 'RCPT TO:<' . $email . '>', [250, 251]);
            $this->command($stream, 'DATA', [354]);
            // Operational parent email only. No child's name, account, or learning data.
            $locales = json_decode((string)file_get_contents(__DIR__ . '/mail-locales.json'), true, 8, JSON_THROW_ON_ERROR);
            $t = $locales[$locale] ?? $locales['en'];
            $body = "HORIZONS Arabic Level 1\n\n" . $t['label'] . ': ' . $code . "\n\n" . $t['expiry'] . "\n\n" . $t['support'] . "\n\n" . $t['privacy'] . "\n\nhttps://horizons-tr.com/\n";
            $subject = $this->subject($t['subject']);
            $message = 'From: HORIZONS <' . $from . ">\r\nTo: <" . $email . ">\r\nSubject: " . $subject . "\r\nDate: " . gmdate('D, d M Y H:i:s') . " +0000\r\nMessage-ID: <" . bin2hex(random_bytes(16)) . "@horizons-tr.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
            $this->send($stream, $message . ".\r\n");
            $this->reply($stream, [250]);
            // A QUIT transport failure after acceptance must not invalidate an already delivered code.
            @fwrite($stream, "QUIT\r\n");
        } finally { fclose($stream); }
    }
}
