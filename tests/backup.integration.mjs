import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { localConfiguration, sourceClient, collectBackup, capture } from '../scripts/lib/backup-source.mjs';
import { makeBundle, decryptBundle, unpackNewDirectory, sha256 } from '../scripts/lib/backup-archive.mjs';
import { saveVerifiedBackup } from '../scripts/backup.mjs';

test('local encrypted DB/photo backup restores into an isolated DB and restores exact photo bytes',async()=>{
  const config=await localConfiguration();
  const admin=sourceClient(config);
  const id=randomUUID(), suffix=randomUUID().replaceAll('-','');
  const db=`church_restore_${suffix}`, dump=`/tmp/church_restore_${suffix}.dump`;
  const root=resolve('.local/recovery',`backup-drill-${suffix}`);
  const parent=resolve('.local/recovery');
  let createdDb=false, imageRow=false, uploaded=false, createdRoot=false;
  const webp=await sharp({create:{width:16,height:16,channels:3,background:'#3c8a65'}}).webp().toBuffer();
  const originalImages=await admin.from('bulletin_images').select('id').order('id');
  assert.ifError(originalImages.error);
  try {
    assert.ifError((await admin.storage.from('bulletin-images').upload(`${id}.webp`,webp,{contentType:'image/webp'})).error); uploaded=true;
    assert.ifError((await admin.from('bulletin_images').insert({id,title:'backup drill fixture',alt:'non-sensitive generated image',width:16,height:16,bytes:webp.length})).error); imageRow=true;
    const collected=await collectBackup({local:true,config});
    const file=collected.files.find((file)=>file.path===`photos/${id}.webp`);
    assert.deepEqual(file.bytes,webp);
    await mkdir(parent,{recursive:true});
    await mkdir(root); createdRoot=true;
    const password=randomBytes(32).toString('hex');
    const recoverable=await saveVerifiedBackup(makeBundle(collected.metadata,collected.files),password,root);
    const restored=await decryptBundle(await readFile(recoverable.path),password);
    const extracted=join(root,'extracted');
    await unpackNewDirectory(restored,extracted);
    await capture('docker',['cp',join(extracted,'database.dump'),`supabase_db_dreaming-good-church:${dump}`]);
    await capture('docker',['exec','supabase_db_dreaming-good-church','createdb','-U','supabase_admin','-T','template0',db]); createdDb=true;
    await capture('docker',['exec','supabase_db_dreaming-good-church','psql','-X','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-c','drop schema public']);
    await capture('docker',['exec','supabase_db_dreaming-good-church','pg_restore','-U','supabase_admin','-d',db,'--exit-on-error','--single-transaction',dump]);
    const restoredRow=await capture('docker',['exec','supabase_db_dreaming-good-church','psql','-X','-U','supabase_admin','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',`select count(*) from public.bulletin_images where id='${id}' and bytes=${webp.length}`]);
    assert.equal(restoredRow.toString().trim(),'1');
    // Restore only our own local fixture, never an existing user's object.
    assert.ifError((await admin.storage.from('bulletin-images').remove([`${id}.webp`])).error);
    const recoveredPhoto=await readFile(join(extracted,'photos',`${id}.webp`));
    assert.ifError((await admin.storage.from('bulletin-images').upload(`${id}.webp`,recoveredPhoto,{contentType:'image/webp'})).error);
    const downloaded=await admin.storage.from('bulletin-images').download(`${id}.webp`);
    assert.ifError(downloaded.error);
    assert.equal(sha256(Buffer.from(await downloaded.data.arrayBuffer())),sha256(webp));
    assert.equal(recoverable.receipt.archiveVerified,true);
  } finally {
    assert.match(db,/^church_restore_[a-f0-9]{32}$/);
    assert.match(dump,/^\/tmp\/church_restore_[a-f0-9]{32}\.dump$/);
    assert.equal(root,join(parent,`backup-drill-${suffix}`));
    const cleanups=[
      async()=>{ if(imageRow) assert.ifError((await admin.from('bulletin_images').delete().eq('id',id)).error); },
      async()=>{ if(uploaded) assert.ifError((await admin.storage.from('bulletin-images').remove([`${id}.webp`])).error); },
      async()=>{ if(createdDb) await capture('docker',['exec','supabase_db_dreaming-good-church','dropdb','-U','supabase_admin',db]); },
      async()=>capture('docker',['exec','supabase_db_dreaming-good-church','rm','-f','--',dump]),
      async()=>{ if(createdRoot) await rm(root,{recursive:true}); },
    ];
    const errors=[];
    for(const cleanup of cleanups) { try { await cleanup(); } catch(error) { errors.push(error); } }
    if(errors.length) throw new AggregateError(errors,'Backup drill cleanup needs attention.');
  }
  const after=await admin.from('bulletin_images').select('id').order('id');
  assert.ifError(after.error); assert.deepEqual(after.data,originalImages.data);
  await writeFile(resolve('.local/encrypted-backup-drill.json'),JSON.stringify({completedAt:new Date().toISOString(),encryptedRoundTrip:true,
    databaseRestore:true,photoFileRestore:true,photoSha256Matched:true,cloudBackupTested:false,temporaryDataRemoved:true},null,2));
});
