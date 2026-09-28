// Text is compressed before encryption to reduce first-open transfer costs.
// Decode only authenticated bytes, with a strict upper bound on decoded size.
export const MAX_DECODED_BYTES = 32 * 1024 * 1024;
export async function decodeContent(bytes, item = {}) {
  if(item.encoding === undefined || item.encoding === 'identity') return bytes;
  if(item.encoding !== 'gzip' || !Number.isSafeInteger(item.decoded_bytes) || item.decoded_bytes < 1 || item.decoded_bytes > MAX_DECODED_BYTES) throw Error('CONTENT_INVALID');
  if(typeof DecompressionStream !== 'function') throw Error('BROWSER_UNSUPPORTED');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const parts=[];let length=0;
  try {
    for(;;) {
      const {value,done}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>item.decoded_bytes)throw Error('CONTENT_INVALID');
      parts.push(value);
    }
    if(length!==item.decoded_bytes)throw Error('CONTENT_INVALID');
    const result=new Uint8Array(length);let offset=0;
    for(const part of parts){result.set(part,offset);offset+=part.byteLength;}
    return result.buffer;
  } catch {await reader.cancel().catch(()=>{});throw Error('CONTENT_INVALID');}
  finally {reader.releaseLock();}
}
