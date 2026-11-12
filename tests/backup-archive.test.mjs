import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeBundle, encryptBundle, decryptBundle, unpackNewDirectory, validateBundle, sha256 } from '../scripts/lib/backup-archive.mjs';
import { saveVerifiedBackup, main } from '../scripts/backup.mjs';
import { collectSqlDumps, PROJECT_REF } from '../scripts/lib/backup-source.mjs';

const password='테스트 전용 복구 문구 · strong random words';
const bundle=makeBundle({target:'local',photoCount:1},[
  {path:'schema.sql',bytes:Buffer.from('가상 비공개 주보\nCREATE TABLE example(id int);')},
  {path:'photos/fixture.webp',bytes:randomBytes(1024*1024)},
]);
let archive;
test('encrypted backup round-trip preserves Korean SQL and binary photos; each encryption is randomized',async()=>{
  archive=await encryptBundle(bundle,password);
  assert.deepEqual(await decryptBundle(archive,password),bundle);
  assert.equal(archive.includes(Buffer.from('가상 비공개 주보')),false);
  assert.notDeepEqual(await encryptBundle(bundle,password),archive);
});
test('wrong password, changed header/ciphertext/tag, truncation and appended bytes are rejected',async()=>{
  await assert.rejects(decryptBundle(archive,`${password}!`));
  for(const offset of [0,8,24,40,archive.length-1]) {
    const changed=Buffer.from(archive); changed[offset]^=1;
    await assert.rejects(decryptBundle(changed,password));
  }
  await assert.rejects(decryptBundle(archive.subarray(0,-8),password));
  await assert.rejects(decryptBundle(Buffer.concat([archive,Buffer.from('extra')]),password));
});
test('unsafe paths, duplicate names, Windows special files, corrupt entries and weak passwords fail closed',async()=>{
  for(const path of ['../escape','/absolute','C:/outside','photos\\escape','photos/../../escape','CON','photos/a:secret','photos/a.']) {
    const invalid=structuredClone(bundle); invalid.files[0].path=path;
    assert.throws(()=>validateBundle(invalid));
  }
  const duplicate=structuredClone(bundle); duplicate.files.push({...duplicate.files[0],path:'SCHEMA.SQL'});
  assert.throws(()=>validateBundle(duplicate));
  const conflicting=structuredClone(bundle); conflicting.files.push({...conflicting.files[0],path:'schema.sql/child'});
  assert.throws(()=>validateBundle(conflicting));
  const corrupt=structuredClone(bundle); corrupt.files[0].sha256='0'.repeat(64);
  assert.throws(()=>validateBundle(corrupt));
  const badTarget=structuredClone(bundle); badTarget.metadata.target='../escape';
  assert.throws(()=>validateBundle(badTarget));
  await assert.rejects(encryptBundle(bundle,'too short'));
});
test('save verifies the encrypted disk copy; extraction refuses existing directories and copy receipts require matching bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'church-backup-test-'));
  try {
    const saved=await saveVerifiedBackup(bundle,password,root);
    assert.equal(saved.receipt.archiveVerified,true);
    assert.equal(saved.receipt.driveCopyVerified,false);
    const bytes=await readFile(saved.path);
    assert.equal(sha256(bytes),saved.receipt.sha256);
    const decoded=await decryptBundle(bytes,password);
    const restored=join(root,'restored');
    await unpackNewDirectory(decoded,restored);
    assert.deepEqual(await readFile(join(restored,'photos/fixture.webp')),Buffer.from(bundle.files[1].data,'base64'));
    await assert.rejects(unpackNewDirectory(decoded,restored),/EEXIST/);
    assert.deepEqual(await readFile(join(restored,'schema.sql')),Buffer.from(bundle.files[0].data,'base64'));
    const copy=join(root,'drive-copy.dgcb'); await writeFile(copy,bytes);
    await main(['check-copy',saved.path,copy]);
    const receipt=JSON.parse(await readFile(`${saved.path}.receipt.json`,'utf8'));
    assert.equal(receipt.copyBytesVerified,true);
    assert.equal(receipt.driveCopyVerified,false);
    await assert.rejects(main(['check-copy',saved.path,saved.path]),/separately/);
    await writeFile(copy,Buffer.from('damaged'));
    await assert.rejects(main(['check-copy',saved.path,copy]),/does not match/);
    assert.ok((await readdir(root)).every((name)=>!name.endsWith('.sql')));
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('non-interactive CLI cannot accept a passphrase from a pipe, argument or environment',async()=>{
  await assert.rejects(main(['create','--production','password']),/Choose exactly/);
  if(!process.stdin.isTTY) await assert.rejects(main(['create','--local']),/interactive terminal/);
});
test('production dumps explicitly target the church project and reject missing Auth or migration data',async()=>{
  const calls=[];
  const runner=async(_command,args)=>{
    calls.push(args);
    if(args.includes('--data-only') && args.includes('--schema')) return Buffer.from('COPY "supabase_migrations"."schema_migrations" (version) FROM stdin;');
    if(args.includes('--data-only')) return Buffer.from('COPY "auth"."users" (id) FROM stdin;\nCOPY "storage"."objects" (id) FROM stdin;');
    return Buffer.from('-- schema/roles fixture');
  };
  assert.equal((await collectSqlDumps(true,runner)).length,5);
  assert.ok(calls.every((args)=>args.includes(`--remote=${PROJECT_REF}`)));
  await assert.rejects(collectSqlDumps(true,async()=>Buffer.from('-- accidentally omitted Auth')),/metadata missing/);
  await assert.rejects(collectSqlDumps(true,async()=>Buffer.alloc(0)),/Empty/);
});
