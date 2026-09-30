<?php
declare(strict_types=1);

namespace HorizonsCommerce;

use PDO;
use RuntimeException;
use Throwable;

/** No HTTP route implements this interface yet. Only a trusted server-side bank
 * adapter may produce receipts, by querying the bank with the stored transaction
 * ID. Browser callbacks and 3-D authentication results are not sale receipts. */
interface BankVerifier
{
    public function querySale(string $transactionId): array;
}

/** Internal preparation only. Not included in cPanel's public deployment.
 * Activation signing, SMTP and device registration stay in the existing private
 * service. Outbox consumers must implement issuer-side idempotency by order_id. */
final class PurchaseLedger
{
    private PDO $db;

    public function __construct(string $databaseFile, string $documentRoot, private array $settings)
    {
        $dir = realpath(dirname($databaseFile));
        $web = realpath($documentRoot);
        if ($dir === false || $web === false || $dir === $web || str_starts_with($dir, $web . DIRECTORY_SEPARATOR)
            || is_link($databaseFile) || (file_exists($databaseFile) && !is_file($databaseFile))) {
            throw new RuntimeException('PRIVATE_DATABASE_REQUIRED');
        }
        // Every ancestor must be private; canonical paths defeat ../ and links
        // into public_html. Never load a buyer-supplied/public price catalog here.
        $this->db = new PDO('sqlite:' . $dir . DIRECTORY_SEPARATOR . basename($databaseFile));
        chmod($databaseFile, 0600);
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->exec('PRAGMA busy_timeout=5000');
        $this->db->exec('PRAGMA foreign_keys=ON');
        $this->db->exec("CREATE TABLE IF NOT EXISTS purchases (
            order_id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL, plan TEXT NOT NULL, currency TEXT NOT NULL,
            amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
            status TEXT NOT NULL CHECK(status IN ('pending','paid','access_ready')),
            paid_at TEXT, account_id TEXT
        )");
        $this->db->exec("CREATE TABLE IF NOT EXISTS outbox (
            order_id TEXT NOT NULL REFERENCES purchases(order_id),
            kind TEXT NOT NULL CHECK(kind IN ('grant_access','send_access_mail')),
            payload TEXT NOT NULL, PRIMARY KEY(order_id,kind)
        )");
    }

    private function atomic(callable $fn): mixed
    {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $result = $fn();
            $this->db->exec('COMMIT');
            return $result;
        } catch (Throwable $e) {
            $this->db->exec('ROLLBACK');
            throw $e;
        }
    }

    private function enabled(): void
    {
        if (($this->settings['charges_enabled'] ?? false) !== true
            || ($this->settings['price_approved'] ?? false) !== true
            || ($this->settings['bank_adapter_approved'] ?? false) !== true
            || ($this->settings['activation_adapter_approved'] ?? false) !== true
            || ($this->settings['product'] ?? '') !== 'horizons-arabic-level1'
            || ($this->settings['max_devices'] ?? 0) !== 3
            || empty($this->settings['merchant_id']) || empty($this->settings['terminal_id'])) {
            throw new RuntimeException('CHECKOUT_NOT_READY');
        }
    }

    public function create(string $email, string $plan): array
    {
        $this->enabled();
        $email = trim($email);
        $price = $this->settings['plans'][$plan] ?? null;
        if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('EMAIL_INVALID');
        }
        if (!in_array($plan, ['monthly', 'annual', 'lifetime'], true) || !is_array($price)
            || !is_int($price['amount_minor'] ?? null) || $price['amount_minor'] < 1
            || $price['amount_minor'] > 100000000
            || !in_array($price['currency'] ?? '', ['TRY', 'USD', 'EUR'], true)) {
            throw new RuntimeException('PLAN_INVALID');
        }
        $orderId = 'HZN-' . bin2hex(random_bytes(12));
        $transactionId = 'HZN' . bin2hex(random_bytes(12));
        $q = $this->db->prepare('INSERT INTO purchases (order_id,transaction_id,email,plan,currency,amount_minor,status) VALUES (?,?,?,?,?,?,?)');
        $q->execute([$orderId, $transactionId, $email, $plan, $price['currency'], $price['amount_minor'], 'pending']);
        return $this->order($orderId);
    }

    public function order(string $orderId): array
    {
        $q = $this->db->prepare('SELECT * FROM purchases WHERE order_id=?');
        $q->execute([$orderId]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new RuntimeException('ORDER_NOT_FOUND');
        $row['amount_minor'] = (int)$row['amount_minor'];
        return $row;
    }

    public function confirm(string $orderId, BankVerifier $bank): array
    {
        $this->enabled();
        $order = $this->order($orderId);
        // A prior verified payment is durable. Retry fulfilment without another
        // sale, query dependency, email job, or renewed entitlement start date.
        if ($order['status'] !== 'pending') return $order;
        $receipt = $bank->querySale($order['transaction_id']);
        $expected = [
            'status' => 'sale_confirmed',
            'merchant_id' => $this->settings['merchant_id'],
            'terminal_id' => $this->settings['terminal_id'],
            'transaction_id' => $order['transaction_id'],
            'order_id' => $order['order_id'],
            'currency' => $order['currency'],
            'amount_minor' => $order['amount_minor'],
        ];
        foreach ($expected as $key => $value) {
            if (!array_key_exists($key, $receipt) || $receipt[$key] !== $value) {
                throw new RuntimeException('BANK_SALE_MISMATCH');
            }
        }
        return $this->atomic(function () use ($orderId): array {
            $current = $this->order($orderId);
            if ($current['status'] !== 'pending') return $current;
            $paid = gmdate('Y-m-d\TH:i:s\Z');
            $this->db->prepare("UPDATE purchases SET status='paid',paid_at=? WHERE order_id=?")->execute([$paid, $orderId]);
            $payload = [
                'schema' => 1, 'order_id' => $orderId,
                'product' => 'horizons-arabic-level1', 'purchase_email' => $current['email'],
                'plan' => $current['plan'], 'channel' => 'direct', 'max_devices' => 3,
                'paid_at' => $paid,
            ];
            $this->enqueue($orderId, 'grant_access', $payload);
            return $this->order($orderId);
        });
    }

    private function enqueue(string $orderId, string $kind, array $payload): void
    {
        $q = $this->db->prepare('INSERT INTO outbox (order_id,kind,payload) VALUES (?,?,?)');
        $q->execute([$orderId, $kind, json_encode($payload, JSON_THROW_ON_ERROR)]);
    }

    /** Call only after the private issuer confirms an idempotent grant for this
     * order and returns its stable account ID. No key/email code is generated. */
    public function markAccessGranted(string $orderId, string $accountId): array
    {
        $this->enabled();
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/D', $accountId)) {
            throw new RuntimeException('ACCOUNT_INVALID');
        }
        return $this->atomic(function () use ($orderId, $accountId): array {
            $current = $this->order($orderId);
            if ($current['status'] === 'pending') throw new RuntimeException('PAYMENT_REQUIRED');
            if ($current['status'] === 'access_ready') {
                if ($current['account_id'] !== $accountId) throw new RuntimeException('ACCOUNT_MISMATCH');
                return $current;
            }
            $this->db->prepare("UPDATE purchases SET status='access_ready',account_id=? WHERE order_id=?")->execute([$accountId, $orderId]);
            $this->enqueue($orderId, 'send_access_mail', [
                'schema' => 1, 'order_id' => $orderId, 'account_id' => $accountId,
                'purchase_email' => $current['email'], 'product' => 'horizons-arabic-level1',
                'plan' => $current['plan'], 'max_devices' => 3, 'open_path' => '/learn/',
            ]);
            return $this->order($orderId);
        });
    }

    public function jobs(string $orderId): array
    {
        $this->order($orderId);
        $q = $this->db->prepare('SELECT kind,payload FROM outbox WHERE order_id=? ORDER BY kind');
        $q->execute([$orderId]);
        return array_map(static fn(array $r): array => ['kind' => $r['kind'], 'payload' => json_decode($r['payload'], true, 512, JSON_THROW_ON_ERROR)], $q->fetchAll(PDO::FETCH_ASSOC));
    }
}
