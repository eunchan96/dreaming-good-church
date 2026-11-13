import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizeImage } from '../lib/image-processing.ts';
test('image normalization validates actual format, bounds dimensions and strips metadata', async () => {
  const input=await sharp({create:{width:3000,height:1500,channels:3,background:'white'}}).jpeg().withMetadata().toBuffer();
  const output=await normalizeImage(input), meta=await sharp(output.data).metadata();
  assert.equal(output.width,2400);assert.equal(output.height,1200);assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);
  await assert.rejects(()=>normalizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
  await assert.rejects(()=>normalizeImage(Buffer.from('fake png')));
  await assert.rejects(()=>normalizeImage(Buffer.alloc(8*1024*1024+1)));
});
