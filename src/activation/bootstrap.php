<?php
declare(strict_types=1);
namespace Horizons;
require_once __DIR__ . '/Core.php';
require_once __DIR__ . '/Network.php';

function application(array $config): Service {
    foreach (['pdo_sqlite','sodium','curl','openssl'] as $extension) if (!extension_loaded($extension)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    if (($config['enabled'] ?? false) !== true) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    if (!preg_match('/^[a-f0-9]{64}$/D', $config['webhook_secret'] ?? '') || !preg_match('#^/[a-zA-Z0-9/_-]+$#D', $config['url_prefix'] ?? '')) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    $templates = json_decode((string)file_get_contents(__DIR__ . '/mail-locales.json'), true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($templates) || count($templates) !== 32 || !isset($templates['en']['subject'])) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    foreach ($templates as $template) foreach (['subject', 'label', 'expiry', 'privacy', 'support'] as $field) {
        if (!is_string($template[$field] ?? null) || $template[$field] === '') throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    }
    $pilotMax = $config['pilot_max_grants'] ?? 0;
    if (!is_int($pilotMax) && !(is_string($pilotMax) && ctype_digit($pilotMax))) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    $pilotMax = (int)$pilotMax;
    if ($pilotMax < 0 || $pilotMax > 100000) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
    // Clock injection is a test constructor dependency; no HTTP/config/environment clock override.
    $purchases = ($config['payments_enabled'] ?? true) === false ? new DisabledPurchases : new Gumroad($config);
    return new Service(new Store($config['database_path']), new Crypto($config), $purchases, new SmtpMailer($config['smtp']), new SystemClock, ($config['auto_trial_enabled'] ?? false) === true, $pilotMax);
}

/** A secret URL is retained for existing Gumroad configuration; header route avoids new URL secrets. */
function authenticateWebhook(string $expected, string $provided): void {
    if (!preg_match('/^[a-f0-9]{64}$/D', $expected) || !hash_equals($expected, $provided)) throw new ServiceError('NOT_FOUND', 404);
}
