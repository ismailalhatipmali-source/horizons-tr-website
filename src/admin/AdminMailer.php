<?php
declare(strict_types=1);
namespace HorizonsAdmin;
use Horizons\ServiceError;
use function Horizons\email;
final class AdminMailer {
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
    public function code(string $email, string $code): void {
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
            $body = "HORIZONS · لوحة الإدارة\n\nرمز دخول الإدارة: " . $code . "\n\nينتهي خلال عشر دقائق ويستخدم مرة واحدة. لا تشاركه مع أحد.\nهذا رمز دخول لوحة الإدارة وليس رمز تفعيل عميل.\n\nhttps://horizons-tr.com/admin/\n";
            $subject = $this->subject('HORIZONS — رمز دخول الإدارة / Admin sign-in');
            $message = 'From: HORIZONS <' . $from . ">\r\nTo: <" . $email . ">\r\nSubject: " . $subject . "\r\nDate: " . gmdate('D, d M Y H:i:s') . " +0000\r\nMessage-ID: <" . bin2hex(random_bytes(16)) . "@horizons-tr.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
            $this->send($stream, $message . ".\r\n");
            $this->reply($stream, [250]);
            // A QUIT transport failure after acceptance must not invalidate an already delivered code.
            @fwrite($stream, "QUIT\r\n");
        } finally { fclose($stream); }
    }
}
