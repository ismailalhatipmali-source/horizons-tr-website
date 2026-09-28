import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {decodeContent,MAX_DECODED_BYTES} from '../src/workbook-web/asset-decoder.js';

test('legacy uncompressed encrypted assets keep their exact bytes',async()=>{
  const input=new TextEncoder().encode('legacy content').buffer;
  assert.equal(await decodeContent(input),input);
});
test('compressed Unicode metadata round-trips without changing content',async()=>{
  const original=Buffer.from('كراستي العربية — الحروف والكلمات. '.repeat(10000));
  const packed=gzipSync(original);
  assert.ok(packed.length<original.length/10);
  assert.deepEqual(Buffer.from(await decodeContent(packed,{encoding:'gzip',decoded_bytes:original.length})),original);
});
test('decoded size bounds reject decompression bombs and short output',async()=>{
  const packed=gzipSync(Buffer.alloc(1024*1024,65));
  for(const length of [1,1024*1024+1,MAX_DECODED_BYTES+1,0,-1,NaN])
    await assert.rejects(decodeContent(packed,{encoding:'gzip',decoded_bytes:length}),/CONTENT_INVALID/);
});
test('damaged compressed input and unknown encodings fail clearly',async()=>{
  await assert.rejects(decodeContent(new Uint8Array([1,2,3]),{encoding:'gzip',decoded_bytes:100}),/CONTENT_INVALID/);
  await assert.rejects(decodeContent(new Uint8Array([1]),{encoding:'unknown',decoded_bytes:1}),/CONTENT_INVALID/);
});
