import test from 'node:test';
import assert from 'node:assert/strict';
import {accountUrl,makeAccountLink,parseAccountHash,PREVIEW_ORIGIN,PRODUCTION_ORIGIN} from '../lib/account-links.mjs';

test('account links target approved origins and keep tokens out of server query strings',()=>{
  for(const origin of [PRODUCTION_ORIGIN,PREVIEW_ORIGIN,'http://localhost:3000','http://127.0.0.1:3001']) {
    const link=new URL(makeAccountLink(origin,'a'.repeat(64),'recovery'));
    assert.equal(link.origin,origin);assert.equal(link.pathname,'/admin/account');assert.equal(link.search,'');
    assert.deepEqual(parseAccountHash(link.hash),{token:'a'.repeat(64),type:'recovery'});
  }
  assert.deepEqual(parseAccountHash(`#token_hash=${'b'.repeat(64)}`),{token:'b'.repeat(64),type:'invite'});
});
test('production account links require the exact approved HTTPS origin',()=>{
  for(const type of ['invite','recovery']) {
    const link=new URL(makeAccountLink(PRODUCTION_ORIGIN,'c'.repeat(64),type));
    assert.equal(link.origin,'https://dreaming-good-church.vercel.app');
    assert.equal(link.pathname,'/admin/account');
    assert.equal(link.search,'');
    assert.deepEqual(parseAccountHash(link.hash),{token:'c'.repeat(64),type});
  }
  for(const origin of ['http://dreaming-good-church.vercel.app','https://dreaming-good-church.vercel.app.attacker.example','https://dreaming-good-church.vercel.app:444','https://dreaming-good-church.vercel.app/admin/account','https://dreaming-good-church.vercel.app?next=evil','https://dreaming-good-church.vercel.app#token','https://user:password@dreaming-good-church.vercel.app']) assert.throws(()=>accountUrl(origin));
});
test('unsafe origins and invalid or duplicate token modes are rejected',()=>{
  for(const origin of ['https://attacker.example','http://localhost:4444','http://localhost:3000/other','http://localhost:3000?next=evil','http://name:password@localhost:3000']) assert.throws(()=>accountUrl(origin));
  for(const hash of ['#token_hash=short',`#token_hash=${'a'.repeat(64)}&type=signup`,`#token_hash=${'a'.repeat(64)}&type=invite&type=recovery`,`#token_hash=${'a'.repeat(64)}&token_hash=${'b'.repeat(64)}`]) assert.throws(()=>parseAccountHash(hash));
});
