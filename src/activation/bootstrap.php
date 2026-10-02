<?php
declare(strict_types=1);
namespace Horizons;
require_once __DIR__ . '/Core.php';
require_once __DIR__ . '/Network.php';
require_once __DIR__ . '/MembershipService.php';

function membershipFeatures(array $config):array {
    $features=is_file(__DIR__.'/features.php')?require __DIR__.'/features.php':[];
    return $config+['memberships_enabled'=>($features['memberships_enabled']??false)===true,'transfer_sales_enabled'=>($features['transfer_sales_enabled']??false)===true];
}

function application(array $config): Service {
    $config=membershipFeatures($config);
    if(($config['payments_enabled']??true)!==false&&!extension_loaded('curl'))throw new ServiceError('SERVICE_UNAVAILABLE',503);
    foreach (['pdo_sqlite','sodium','openssl'] as $extension) if (!extension_loaded($extension)) throw new ServiceError('SERVICE_UNAVAILABLE', 503);
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
    $store=new Store($config['database_path']);$crypto=new Crypto($config);$mailer=new SmtpMailer($config['smtp']);$memberships=null;
    if(($config['memberships_enabled']??false)===true){new MembershipBridge($store,$crypto);$memberships=new MembershipService($store,$crypto,$mailer);}
    return new Service($store,$crypto,$purchases,$mailer,new SystemClock,($config['auto_trial_enabled']??false)===true,$pilotMax,$memberships);
}

/** A secret URL is retained for existing Gumroad configuration; header route avoids new URL secrets. */
function authenticateWebhook(string $expected, string $provided): void {
    if (!preg_match('/^[a-f0-9]{64}$/D', $expected) || !hash_equals($expected, $provided)) throw new ServiceError('NOT_FOUND', 404);
}

function membershipApplication(array $config):array {
    $config=membershipFeatures($config);if(($config['enabled']??false)!==true||($config['memberships_enabled']??false)!==true)throw new ServiceError('SERVICE_UNAVAILABLE',503);
    $store=new Store($config['database_path']);$crypto=new Crypto($config);$bridge=new MembershipBridge($store,$crypto);$service=new MembershipService($store,$crypto,new SmtpMailer($config['smtp']));
    $root=$config['document_root']??dirname(dirname($config['code_path'])).'/public_html';
    $members=new \HorizonsCommerce\MembershipLedger(dirname($config['database_path']).'/memberships.sqlite',$root,hash_hmac('sha256','membership-ledger-v1',$crypto->dataKey,true));return [$service,$members,$bridge];
}
