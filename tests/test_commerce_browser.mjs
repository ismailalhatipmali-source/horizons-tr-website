import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {join}from'node:path';
const{chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href);
const base=process.env.HZN_COMMERCE_BASE_URL||'http://127.0.0.1:8766';assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const browser=await chromium.launch({executablePath:process.env.E2E_CHROMIUM||'/tmp/horizons-demo-chromium/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ar/index.html');await page.locator('[data-horizons-action=open]').first().click();assert.equal(await page.locator('[data-start-dialog]').isVisible(),true);
 await page.locator('[data-start-dialog] a[href="cart.html#accounts"]').click();
 for(const[account,term]of[['individual','monthly'],['family','lifetime'],['institution','annual']]){
  await page.locator('[data-account="'+account+'"][data-plan="'+term+'"]').click();assert.equal(await page.locator('.commerce-cart-badge').innerText(),'1');
  await page.goto(base+'/ar/about.html');assert.equal(await page.locator('.commerce-cart-badge').isVisible(),true);await page.locator('.commerce-floating-cart').click();
  assert.equal(new URL(page.url()).searchParams.get('account'),account);await page.locator('.commerce-grid a[data-commerce-link="checkout.html"]').click();
  assert.equal(await page.locator('[data-payment-submit]').isDisabled(),true);assert.equal(await page.locator('input[value=card]').isDisabled(),true);
  assert.equal(await page.locator('[name=permanent]').isVisible(),account!=='institution');
  await page.locator('.commerce-steps a[data-commerce-link="cart.html"]').click();
 }
 for(const lang of'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split(' ')){
  await page.goto(base+'/'+lang+'/cart.html?account=family&plan=lifetime');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,lang+' mobile overflow');
 }
 await page.goto(base+'/ar/checkout.html?account=family&plan=annual&success=true&email=forged');assert.equal(new URL(page.url()).search,'?account=family&plan=annual');
 await page.locator('#commerce-countries option').first().waitFor({state:'attached'});
 for(const[k,v]of Object.entries({name:'Synthetic Buyer',email:'test@example.com',email_confirm:'test@example.com',country:'تركيا',address:'Synthetic street 1'}))await page.locator('[name="'+k+'"]').fill(v);
 await page.locator('#commerce-cities option').first().waitFor({state:'attached'});await page.locator('[name=city]').fill('إسطنبول');await page.locator('[name=consent]').check();
 await page.locator('[data-review-order]').click();assert.equal(await page.locator('[data-order-review]').isVisible(),false);await page.locator('[name=permanent]').check();await page.locator('[data-review-order]').click();assert.equal(await page.locator('[data-order-review]').isVisible(),true);
 assert.equal(await page.locator('[data-payment-submit]').isDisabled(),true);await page.screenshot({path:'/tmp/horizons-account-checkout.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: browser start dialog, 32 mobile locales, 3 account types, persistent cart, local location suggestions, email confirmation and consent; collection disabled.');
}finally{await browser.close();}
