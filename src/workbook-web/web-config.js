// Public configuration only. Never place an owner vault or SMTP credentials here.
export const PRODUCT = 'horizons-arabic-level1';
export const ISSUER_PUBLIC_KEY = '3s4ebUqdPP3OchdsJMeQLuWIBI4pJuB0Lhu60U4jnEo=';
export const VERSION = '1.4.4';
export const ACTIVATION_URL = '/activation';
export const CONTENT_PREFIX = './content/1.4.0/';
export const WEB_CONFIG = Object.freeze({product:PRODUCT, public_key:ISSUER_PUBLIC_KEY, version:VERSION, activation_url:ACTIVATION_URL, content_prefix:CONTENT_PREFIX});
export default WEB_CONFIG;
