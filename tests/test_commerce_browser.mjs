import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href);
const base=process.env.HZN_COMMERCE_BASE_URL||'http://127.0.0.1:8766';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const browser=await chromium.launch({executablePath:process.env.E2E_CHROMIUM||'/tmp/horizons-demo-chromium/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar'});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ar/cart.html');
 await page.evaluate(()=>localStorage.setItem('learner-progress-test','preserved'));
 for(const plan of ['monthly','annual','lifetime']) {
  await page.locator('[data-plan="'+plan+'"]').click();
  await page.locator('.commerce-grid a[data-commerce-link="checkout.html"]').click();
  assert.equal(new URL(page.url()).searchParams.get('plan'),plan);
  assert.equal(await page.locator('input[type=email]').isDisabled(),false);
  assert.equal(await page.locator('[data-payment-submit]').isDisabled(),true);
  await page.locator('input[value=transfer]').check();
  assert.equal(await page.locator('[data-method-note=transfer]').isVisible(),true);
  await page.locator('.commerce-steps a[data-commerce-link="cart.html"]').click();
 }
 await page.locator('[data-remove]').click();assert.equal(await page.locator('[data-empty]').isVisible(),true);
 await page.goto(base+'/en/checkout.html?plan=annual&success=true&email=untrusted');
 assert.equal(new URL(page.url()).search,'?plan=annual');
 assert.equal(await page.locator('[data-payment-submit]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('learner-progress-test')),'preserved');
 for(const lang of 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split(' ')) {
  await page.goto(base+'/'+lang+'/cart.html?plan=lifetime');
  assert.ok((await page.locator('[data-money]').innerText()).length>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,lang+' must fit mobile');
 }
 await page.goto(base+'/ar/checkout.html?plan=annual');
 for(const [key,value] of Object.entries({name:'Test Buyer',email:'test@example.com',country:'Türkiye',city:'İstanbul',address:'Test invoice address'})) await page.locator('[name="'+key+'"]').fill(value);
 await page.locator('[name=consent]').check();
 await page.locator('[data-review-order]').click();
 assert.equal(await page.locator('[data-order-review]').isVisible(),true);
 assert.equal(await page.locator('[data-payment-submit]').isDisabled(),true);
 await page.screenshot({path:'/tmp/horizons-checkout-review.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: 32 mobile locales, three plans, cart/checkout/remove, transfer option, disabled collection, forged-success rejection, learner data preservation');
} finally {await browser.close();}
