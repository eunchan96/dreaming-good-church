import test from 'node:test';
import assert from 'node:assert/strict';
import { copyRowCounts, sqlBackupContents } from '../scripts/lib/restore-sql-backup.mjs';
import { makeBundle, sha256 } from '../scripts/lib/backup-archive.mjs';

const names=['bulletins','bulletin_items','community_entries','church_info','bulletin_images','church_editors'];
function fixture() {
  const inventory=Buffer.from(JSON.stringify({tables:Object.fromEntries(names.map((name)=>[name,[]])),bucket:{id:'bulletin-images',public:false},objects:[]}));
  const copy=(schema,table,rows='')=>`COPY "${schema}"."${table}" (id) FROM stdin;\n${rows}\\.\n`;
  const data=names.map((name)=>copy('public',name)).join('')+copy('auth','users')+copy('storage','buckets')+copy('storage','objects');
  const files=[{path:'roles.sql',bytes:Buffer.from('-- no custom roles')},{path:'schema.sql',bytes:Buffer.from('-- test schema')},
    {path:'data.sql',bytes:Buffer.from(data)},{path:'history-schema.sql',bytes:Buffer.from('-- history')},
    {path:'history-data.sql',bytes:Buffer.from(copy('supabase_migrations','schema_migrations','20261112072355\n'))},
    {path:'inventory.json',bytes:inventory},{path:'migrations/20261112072355_church_info_images.sql',bytes:Buffer.from('create policy "read permitted bulletin images" on storage.objects for select to anon,authenticated\nusing(bucket_id=\'bulletin-images\');')}];
  return makeBundle({target:'local',sourceInventorySha256:sha256(inventory),photoCount:0},files);
}

test('COPY counts include blank rows and escaped text without interpreting row contents',()=>{
  assert.deepEqual(copyRowCounts('COPY "auth"."users" (id) FROM stdin;\n\nnot\\nnewlines\n\\\\.\n\\.\n'),{'auth.users':3});
  assert.throws(()=>copyRowCounts('COPY public.bulletins (id) FROM stdin;\nprivate row\n'),/Unterminated/);
  assert.throws(()=>copyRowCounts('COPY public.bulletins (id) FROM stdin;\n\\.\nCOPY public.bulletins (id) FROM stdin;\n\\.\n'),/Duplicate/);
});
test('SQL bundle requires application/Auth/storage/migration sections and exact inventory',()=>{
  const valid=fixture();
  assert.equal(sqlBackupContents(valid).counts['supabase_migrations.schema_migrations'],1);
  for(const file of ['data.sql','history-data.sql','inventory.json']) {
    const incomplete=structuredClone(valid); incomplete.files=incomplete.files.filter((entry)=>entry.path!==file);
    assert.throws(()=>sqlBackupContents(incomplete),/missing/);
  }
  const damaged=structuredClone(valid);damaged.metadata.sourceInventorySha256='0'.repeat(64);
  assert.throws(()=>sqlBackupContents(damaged),/checksum/);
  const missingPolicy=structuredClone(valid);missingPolicy.files=missingPolicy.files.filter((entry)=>!entry.path.startsWith('migrations/'));
  assert.throws(()=>sqlBackupContents(missingPolicy),/Migration/);
  const badPhotos=structuredClone(valid);badPhotos.metadata.photoCount=1;
  assert.throws(()=>sqlBackupContents(badPhotos),/Photo inventory/);
});
