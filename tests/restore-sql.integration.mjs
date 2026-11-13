import test from 'node:test';
import assert from 'node:assert/strict';
import { localConfiguration,collectBackup,collectSqlDumps,capture } from '../scripts/lib/backup-source.mjs';
import { makeBundle } from '../scripts/lib/backup-archive.mjs';
import { restoreSqlBackup } from '../scripts/lib/restore-sql-backup.mjs';

test('SQL restore succeeds in a separate networkless container and cleans up both success and SQL failure',async()=>{
  const config=await localConfiguration();
  const local=await collectBackup({local:true,config});
  const sql=await collectSqlDumps(false);
  const files=[...local.files.filter((file)=>!['database.dump','roles.sql'].includes(file.path)),...sql];
  const bundle=makeBundle(local.metadata,files);
  const result=await restoreSqlBackup(bundle);
  assert.equal(result.applicationValuesMatched,true);
  assert.equal(result.rlsAndPublicationPassed,true);
  assert.equal(result.networkDisabled,true);
  assert.equal(result.noHostPortsOrVolumes,true);
  assert.equal(result.temporaryContainerRemoved,true);
  const broken=makeBundle(local.metadata,files.map((file)=>file.path==='schema.sql'?{...file,bytes:Buffer.concat([file.bytes,Buffer.from('\nselect 1/0;\n')])}:file));
  await assert.rejects(restoreSqlBackup(broken),/Backed-up application schema failed.*22012/);
  const left=(await capture('docker',['ps','-aq','--filter','label=church.restore-drill'])).toString().trim();
  assert.equal(left,'');
});
