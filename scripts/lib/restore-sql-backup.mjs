import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateBundle, sha256, MAX_FILE_BYTES } from './backup-archive.mjs';
import { capture, PROJECT_REF } from './backup-source.mjs';

const SOURCE='supabase_db_dreaming-good-church';
const ADMIN='supabase_admin';
const LABEL='church.restore-drill';
const KEYS={bulletins:'id',bulletin_items:'id',community_entries:'id',church_info:'key',bulletin_images:'id',church_editors:'user_id'};

function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonical(value[key])]));
  return value;
}

// COPY text escapes embedded newlines. Never include row contents in errors/reports.
export function copyRowCounts(sql) {
  const counts={}; let active=null;
  for(const raw of sql.split('\n')) {
    const line=raw.replace(/\r$/,'');
    if(active) { if(line==='\\.') active=null; else counts[active]++; continue; }
    const match=/^COPY "?([a-z_][a-z0-9_]*)"?\."?([a-z_][a-z0-9_]*)"? \(.*\) FROM stdin;$/.exec(line);
    if(match) {
      const name=`${match[1]}.${match[2]}`;
      if(Object.hasOwn(counts,name)) throw new Error('Duplicate COPY section in backup.');
      active=name; counts[name]=0;
    }
  }
  if(active) throw new Error('Unterminated COPY section in backup.');
  return counts;
}

export function sqlBackupContents(bundle) {
  validateBundle(bundle);
  if(!['local',PROJECT_REF].includes(bundle.metadata.target)) throw new Error('Unexpected SQL backup source.');
  const files=new Map(bundle.files.map((file)=>[file.path,Buffer.from(file.data,'base64')]));
  for(const name of ['roles.sql','schema.sql','data.sql','history-schema.sql','history-data.sql','inventory.json']) {
    if(!files.get(name)?.length) throw new Error(`SQL backup is missing ${name}.`);
  }
  const counts={...copyRowCounts(files.get('data.sql').toString()),...copyRowCounts(files.get('history-data.sql').toString())};
  for(const name of [...Object.keys(KEYS).map((name)=>`public.${name}`),'auth.users','storage.buckets','storage.objects','supabase_migrations.schema_migrations']) {
    if(!Object.hasOwn(counts,name)) throw new Error(`Backup COPY section missing: ${name}.`);
  }
  const inventory=JSON.parse(files.get('inventory.json').toString());
  if(sha256(files.get('inventory.json'))!==bundle.metadata.sourceInventorySha256) throw new Error('Backup inventory checksum mismatch.');
  if(!inventory.tables || !Array.isArray(inventory.objects) || inventory.bucket?.id!=='bulletin-images' || inventory.bucket.public!==false) throw new Error('Invalid private photo inventory.');
  for(const name of Object.keys(KEYS)) {
    if(!Array.isArray(inventory.tables[name]) || inventory.tables[name].length!==counts[`public.${name}`]) throw new Error(`Snapshot row count differs: ${name}.`);
  }
  const migrationNames=[...files.keys()].filter((name)=>/^migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(name));
  if(!migrationNames.length || migrationNames.length!==counts['supabase_migrations.schema_migrations']) throw new Error('Migration inventory differs.');
  const matches=migrationNames.flatMap((name)=>files.get(name).toString().match(/create policy "read permitted bulletin images" on storage\.objects for select to anon,authenticated\s+using\([\s\S]*?\);/gi)??[]);
  if(matches.length!==1) throw new Error('Expected one backed-up photo access policy.');
  const names=new Set(inventory.objects.map((object)=>object.name));
  const photos=[...files.keys()].filter((name)=>name.startsWith('photos/'));
  if(photos.length!==names.size || photos.length!==bundle.metadata.photoCount) throw new Error('Photo inventory count differs.');
  for(const name of photos) if(!names.has(name.slice(7))) throw new Error('Unexpected photo in backup.');
  for(const image of inventory.tables.bulletin_images) if(!files.has(`photos/${image.id}.webp`)) throw new Error('Image reference missing from backup.');
  return {files,counts,inventory,migrationNames,photoPolicy:matches[0]};
}

async function docker(args,{input,signal,stage='Docker',limit=MAX_FILE_BYTES}={}) {
  return new Promise((resolveResult,reject)=>{
    const child=spawn('docker',args,{stdio:['pipe','pipe','pipe'],windowsHide:true,signal});
    const chunks=[]; let size=0,errorText='',tooLarge=false;
    const timer=setTimeout(()=>child.kill(),180000);
    child.stdout.on('data',(chunk)=>{ size+=chunk.length; if(size>limit) {tooLarge=true;child.kill();} else chunks.push(chunk); });
    child.stderr.on('data',(chunk)=>{if(errorText.length<8192) errorText+=chunk.toString();});
    child.stdin.on('error',()=>{}); // EPIPE is reported by the command's exit status.
    child.on('error',()=>{clearTimeout(timer);reject(new Error(`${stage} could not start or was cancelled.`));});
    child.on('close',(code)=>{
      clearTimeout(timer);
      const state=/ERROR:\s+([0-9A-Z]{5})\b/.exec(errorText)?.[1];
      const roleError=stage==='Platform role bootstrap'?/ERROR:\s*([^\r\n]*)/.exec(errorText)?.[1]:null;
      const missingSchema=/schema "([a-z_][a-z0-9_]*)" does not exist/.exec(errorText)?.[1];
      const missingObject=/(publication|role|type|extension|event trigger) "([a-z_][a-z0-9_.]*)" does not exist/.exec(errorText);
      if(code!==0||tooLarge) reject(new Error(`${stage} failed${state?` (SQLSTATE ${state})`:''}${roleError?`: ${roleError}`:''}${missingSchema?` (missing schema ${missingSchema})`:''}${missingObject?` (missing ${missingObject[1]} ${missingObject[2]})`:''}. No SQL or account contents were logged.`));
      else resolveResult(Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
}

export async function restoreSqlBackup(bundle) {
  const {files,counts,inventory,migrationNames,photoPolicy}=sqlBackupContents(bundle);
  const [context]=JSON.parse((await capture('docker',['context','inspect'])).toString());
  const localEndpoint=(value)=>typeof value==='string' && /^(npipe|unix):\/\//.test(value);
  if(!localEndpoint(context.Endpoints?.docker?.Host) || (process.env.DOCKER_HOST&&!localEndpoint(process.env.DOCKER_HOST))) throw new Error('SQL restore checks require a local Docker pipe/socket, not a remote Docker endpoint.');
  // Only metadata/DDL/role definitions without passwords are read from the local source.
  const image=(await capture('docker',['inspect','--format','{{.Image}}',SOURCE],1024)).toString().trim();
  if(!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Expected a local PostgreSQL image ID.');
  const roles=await capture('docker',['exec',SOURCE,'pg_dumpall','-U','supabase_admin','--roles-only','--no-role-passwords']);
  const managed=(section)=>capture('docker',['exec',SOURCE,'pg_dump','-U','supabase_admin','-d','postgres','--schema-only',`--section=${section}`,
    '-n','auth','-n','storage','-n','extensions','-n','supabase_functions','-n','vault']);
  const pre=await managed('pre-data'),post=await managed('post-data');
  // Managed primary keys must exist before church_editors can reference auth.users.
  // This one APP policy references public tables, so restore it later from backup.
  const delayedPolicy=/^CREATE POLICY "read permitted bulletin images" ON "?storage"?\."?objects"?[\s\S]*?;\r?$/gm;
  const managedPost=post.toString().replace(delayedPolicy,'-- App photo policy restored from backed-up migration after application DDL.');
  const suffix=randomUUID().replaceAll('-',''),name=`church-sql-restore-${suffix}`,database=`church_restore_${suffix}`;
  const abort=new AbortController();
  const cancel=()=>abort.abort();
  process.on('SIGINT',cancel); process.on('SIGTERM',cancel);
  let report;
  const run=(args,options={})=>docker(args,{...options,signal:abort.signal});
  const sql=(input,stage)=>run(['exec','-i',name,'psql','-X','-h','/tmp','-U',ADMIN,'-d',database,'-qAt','-v','ON_ERROR_STOP=1','-v',`VERBOSITY=${stage==='Platform role bootstrap'?'default':'verbose'}`,'-v','SHOW_CONTEXT=never'],{input,stage});
  try {
    await run(['run','--detach','--pull','never','--name',name,'--label',`${LABEL}=${suffix}`,'--network','none','--read-only',
      '--user','100:101','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','512m','--cpus','1','--pids-limit','100','--no-healthcheck','--log-driver','none',
      '--tmpfs','/tmp:rw,nosuid,nodev,size=512m,uid=100,gid=101,mode=0700','--entrypoint','sh',image,'-c',
      'initdb -D /tmp/pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 > /tmp/init.log 2>&1 && exec postgres -D /tmp/pgdata -c listen_addresses= -c unix_socket_directories=/tmp -c timezone=UTC -c shared_buffers=32MB -c max_connections=10 -c fsync=off -c log_min_error_statement=panic'],{stage:'Isolated container start'});
    const [details]=JSON.parse((await run(['inspect',name])).toString());
    if(details.Config.Labels?.[LABEL]!==suffix || details.HostConfig.NetworkMode!=='none'||!details.HostConfig.ReadonlyRootfs ||
      details.Mounts.length || Object.keys(details.HostConfig.PortBindings??{}).length || details.HostConfig.LogConfig.Type!=='none') throw new Error('Restore isolation check failed.');
    let ready=false;
    for(let attempt=0;attempt<30;attempt++) {
      if(abort.signal.aborted) throw new Error('Restore cancelled.');
      try {await run(['exec',name,'pg_isready','-h','/tmp','-U',ADMIN]);ready=true;break;} catch {await new Promise((done)=>setTimeout(done,500));}
    }
    if(!ready) throw new Error('Isolated PostgreSQL was not ready.');
    await run(['exec',name,'createdb','-h','/tmp','-U',ADMIN,'-T','template0',database]);
    // Use the recorded grantor as the INITIAL session user. SET ROLE alone
    // cannot reproduce GRANTED BY membership statements on this PG version.
    // initdb already created this one role inside the disposable cluster.
    await sql(roles.toString().replace(/^CREATE ROLE supabase_admin;\r?$/m,'-- Supabase bootstrap administrator already exists.'),'Platform role bootstrap');
    await sql(files.get('roles.sql'),'Backed-up custom roles');
    await sql(pre,'Managed schema bootstrap');
    await sql(managedPost,'Managed constraints and grants');
    // Supabase's schema dump alters this platform-created publication's owner.
    await sql('create publication supabase_realtime;','Managed Realtime publication');
    await sql(files.get('schema.sql'),'Backed-up application schema');
    // Replace the local platform copy of this app policy with the BACKUP's version.
    await sql(`drop policy if exists "read permitted bulletin images" on storage.objects;\n${photoPolicy}`,'Backed-up photo access policy');
    await sql(files.get('history-schema.sql'),'Backed-up migration schema');
    await sql(files.get('data.sql'),'Backed-up data COPY');
    await sql(files.get('history-data.sql'),'Backed-up migration data');
    // COPY restores with triggers disabled; re-create/validate FKs so an orphan
    // cannot pass merely because a pre-existing empty-table constraint was valid.
    await sql(`do $$ declare item record; definition text; begin
      for item in select c.conname,c.conrelid,pg_get_constraintdef(c.oid) as definition
        from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
        where c.contype='f' and n.nspname in ('public','auth','storage','supabase_functions') order by c.oid loop
        definition=regexp_replace(item.definition,' NOT VALID$','');
        execute format('alter table %s drop constraint %I',item.conrelid::regclass,item.conname);
        execute format('alter table %s add constraint %I %s not valid',item.conrelid::regclass,item.conname,definition);
        execute format('alter table %s validate constraint %I',item.conrelid::regclass,item.conname);
      end loop;
    end $$;`,'Restored foreign key validation');
    const actualCounts=JSON.parse((await sql(`select jsonb_object_agg(name,total) from (${Object.keys(counts).map((name)=>{
      const [schema,table]=name.split('.');return `select '${name}' as name,count(*) as total from "${schema}"."${table}"`;
    }).join(' union all ')}) rows;`,'Restored row counts')).toString());
    if(JSON.stringify(canonical(counts))!==JSON.stringify(canonical(actualCounts))) throw new Error('Restored COPY row counts differ.');
    const actualTables=JSON.parse((await sql(`select jsonb_build_object(${Object.entries(KEYS).map(([table,key])=>
      `'${table}',coalesce((select jsonb_agg(to_jsonb(t) order by "${key}") from public."${table}" t),'[]'::jsonb)`).join(',')});`,'Restored application values')).toString());
    if(JSON.stringify(canonical(actualTables))!==JSON.stringify(canonical(inventory.tables))) throw new Error('Restored application values differ from backup inventory.');
    const versions=JSON.parse((await sql('select jsonb_agg(version order by version) from supabase_migrations.schema_migrations;','Restored migration versions')).toString());
    const expected=migrationNames.map((name)=>name.slice(11,25)).sort();
    if(JSON.stringify(versions)!==JSON.stringify(expected)) throw new Error('Restored migration versions differ.');
    const acceptance=await readFile(new URL('../../tests/restore-acceptance.sql',import.meta.url));
    await sql(acceptance,'Restored anonymous/editor/publication acceptance');
    report={checkedAt:new Date().toISOString(),backupTarget:bundle.metadata.target,copiedTables:Object.keys(counts).length,
      applicationTablesCompared:6,authUsers:counts['auth.users'],migrationCount:versions.length,photoFiles:inventory.objects.length,
      rowCountsMatched:true,applicationValuesMatched:true,foreignKeysValidated:true,rlsAndPublicationPassed:true,photoPolicyFromBackup:true,
      networkDisabled:true,noHostPortsOrVolumes:true,plaintextWrittenToHost:false,remoteAccess:false,
      limitations:['Managed service schema and platform roles bootstrapped from local stack','Auth HTTP login, Storage HTTP restoration and hosted failover not tested']};
  } finally {
    try {
    // An interrupted `docker run` may have created the container without returning an ID.
    // Inspect our unique name+label before removing anything; never remove the source.
    const found=(await docker(['ps','-aq','--filter',`name=^/${name}$`],{stage:'Restore cleanup lookup',limit:1024})).toString().trim();
    if(found) {
      if(!/^[a-f0-9]{12,64}$/.test(found)) throw new Error('Unsafe restore cleanup ID.');
      const [details]=JSON.parse((await docker(['inspect',found],{stage:'Restore cleanup ownership'})).toString());
      if(details.Name!==`/${name}`||details.Config.Labels?.[LABEL]!==suffix) throw new Error('Restore cleanup ownership mismatch.');
      await docker(['rm','--force','--volumes',found],{stage:'Restore container removal'});
      const remaining=(await docker(['ps','-aq','--filter',`label=${LABEL}=${suffix}`],{stage:'Restore cleanup verification'})).toString().trim();
      if(remaining) throw new Error('Restore container remains; cleanup needs attention.');
    }
    } finally { process.removeListener('SIGINT',cancel); process.removeListener('SIGTERM',cancel); }
  }
  return {...report,temporaryContainerRemoved:true};
}
