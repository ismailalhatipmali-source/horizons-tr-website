(() => { window.HORIZONS_BOOT ??= {ready:false,errors:[]}; setTimeout(() => { const box=document.getElementById('startup-help'); if(box&&!window.HORIZONS_BOOT.ready)box.hidden=false; },6000); })();
