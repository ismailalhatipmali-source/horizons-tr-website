'use strict';
const token=location.hash.slice(1),button=document.getElementById('download');
if(/^[a-f0-9]{64}$/.test(token)){
  document.querySelector('input[name=token]').value=token;button.disabled=false;
  document.getElementById('message').textContent='Your private link is valid for 7 days and up to 5 downloads. Keep a backup of the ZIP.';
  history.replaceState(null,'',location.pathname);
}
if((navigator.language||'').startsWith('ar')){document.documentElement.lang='ar';document.documentElement.dir='rtl';button.textContent='تحميل الحزمة';document.getElementById('message').textContent=button.disabled?'استخدم رابط التسليم الخاص الذي أرسلته HORIZONS بعد التحقق من الدفع.':'الرابط الخاص صالح لسبعة أيام ولغاية خمس عمليات تحميل. احتفظ بنسخة من الملف المضغوط.';}
