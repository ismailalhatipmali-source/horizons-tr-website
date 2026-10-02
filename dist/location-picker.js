// Self-hosted public geographic labels only. No geolocation or external calls.
(async () => {
  const form=document.querySelector('[data-buyer-form]');if(!form)return;
  const country=form.elements.country,city=form.elements.city;
  const countryList=document.getElementById('commerce-countries'),cityList=document.getElementById('commerce-cities');
  const base=new URL('../assets/commerce-geo/',location.href),lang=document.documentElement.lang;
  let names=new Map(),cities=[],generation=0,currentCode='',controller=null;
  const options=(target,values)=>{target.replaceChildren();for(const value of values){const o=document.createElement('option');o.value=value;target.append(o);}};
  function suggestions() {
    const text=city.value.trim().toLocaleLowerCase(lang);
    options(cityList,cities.filter(n=>n.toLocaleLowerCase(lang).includes(text)).slice(0,100));
  }
  async function changed() {
    const code=names.get(country.value.trim())||'';
    if(names.size)country.setCustomValidity(code?'':country.closest('label').childNodes[0].textContent.trim());
    if(code===currentCode)return;currentCode=code;generation++;const ticket=generation;
    controller?.abort();controller=new AbortController();cities=[];city.value='';options(cityList,[]);
    if(!code)return;
    city.setAttribute('aria-busy','true');
    try {
      const r=await fetch(new URL(code+'.json',base),{credentials:'omit',signal:controller.signal});if(!r.ok)throw Error();
      const data=await r.json();if(ticket!==generation)return;
      cities=data.map(row=>lang==='ar'&&row[1]?row[1]:row[0]);suggestions();
    } catch { /* Manual city entry still works if unavailable or offline. */ }
    finally {if(ticket===generation)city.removeAttribute('aria-busy');}
  }
  country.addEventListener('input',changed);country.addEventListener('change',changed);city.addEventListener('input',suggestions);
  try {
    const r=await fetch(new URL('countries.json',base),{credentials:'omit'});if(!r.ok)throw Error();
    const rows=await r.json();let display=null;
    try {display=new Intl.DisplayNames([lang],{type:'region'});}catch{}
    const labels=rows.filter(x=>/^[A-Z]{2}$/.test(x.code)).map(x=>[display?.of(x.code)||x.name,x.code]);
    labels.sort((a,b)=>a[0].localeCompare(b[0],lang));names=new Map(labels);options(countryList,labels.map(x=>x[0]));
    await changed();
  } catch { /* Required manual country/city fields remain available. */ }
})();
