// Same-origin only. No remote storage, analytics, account, or subscription.
const OFFLINE_BUILD='1.0.2-demo';
function workerMessage(worker, data, onProgress = () => {}, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(); let timer, settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); channel.port1.close();
      error ? reject(error) : resolve(value);
    };
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error('Offline download timed out')), timeout);
    };
    channel.port1.onmessage = event => {
      if (settled) return;
      resetTimer(); const message = event.data;
      if (typeof message?.done === 'number') {
        try { onProgress(message); } catch (error) { finish(error); return; }
      }
      if (message?.ok === true || typeof message?.version === 'string') finish(null, message);
      else if (message?.ok === false) finish(new Error(message.error || 'Offline download failed'));
    };
    resetTimer();
    try { worker.postMessage(data, [channel.port2]); } catch (error) { finish(error); }
  });
}
export async function prepareOffline(group, onProgress = () => {}) {
  if (/(?:^|[?&])local=1(?:&|$)/.test(location.search ?? '')) {
    const e = new Error('The complete local package is already served from this computer.');
    e.code = 'LOCAL_SERVER'; throw e;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    const e = new Error('Offline caching needs HTTPS or localhost. Local files still work through the local server.');
    e.code = 'UNSUPPORTED'; throw e;
  }
  const requested = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {updateViaCache:'none'});
  let readyTimer;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Service worker activation timeout')), 20000); })
  ]).finally(() => clearTimeout(readyTimer));
  // Use this page's controller; an installing/waiting release must not download
  // different content while the current workbook is still open.
  if (registration.scope !== requested.scope) throw new Error('Offline workbook scope mismatch');
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) throw new Error('No active service worker');
  const info = await workerMessage(worker, {type:'get-version'}, () => {}, 10000);
  if (info.version !== OFFLINE_BUILD) {
    const e = new Error('A workbook update is ready. Close its open tabs and reopen the workbook before downloading.');
    e.code = 'UPDATE_REQUIRED'; throw e;
  }
  return workerMessage(worker, {type:'cache-group', group, version:OFFLINE_BUILD}, onProgress);
}
