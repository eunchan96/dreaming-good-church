import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { MAX_FILE_BYTES, sha256 } from './backup-archive.mjs';

export const PROJECT_REF = 'zefnxczgwpsmfcixonpb';
const CLI = resolve('node_modules/supabase/dist/supabase.js');
const TABLE_KEYS = { bulletins: 'id', bulletin_items: 'id', community_entries: 'id', church_info: 'key', bulletin_images: 'id', church_editors: 'user_id',worship_videos:'id',homepage_content:'id' };
export function appliedMigrationVersions(sql){
 const match=/COPY\s+"?supabase_migrations"?\."?schema_migrations"?\s*\(([^)]+)\) FROM stdin;\r?\n([\s\S]*?)\r?\n\\\./.exec(sql);
 if(!match)throw new Error('Migration history COPY missing.');
 const column=match[1].split(',').map(value=>value.trim().replaceAll('"','')).indexOf('version');
 const versions=match[2].split(/\r?\n/).filter(Boolean).map(line=>line.split('\t')[column]);
 if(column<0||!versions.length||versions.some(value=>!/^\d{14}$/.test(value))||new Set(versions).size!==versions.length)throw new Error('Invalid applied migration history.');
 return versions.sort();
}
export async function capture(command, args, limit = MAX_FILE_BYTES) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { stdio: ['ignore','pipe','pipe'], windowsHide: true });
    const chunks = []; let length = 0, exceeded = false;
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Backup command timed out.')); }, 180000);
    child.stdout.on('data', (chunk) => { length += chunk.length; if (length > limit) { exceeded = true; child.kill(); } else chunks.push(chunk); });
    // Never echo raw subprocess errors: they may contain a connection URL/token.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timeout); reject(new Error('Backup command could not start.')); });
    child.on('close', (code) => { clearTimeout(timeout); if (exceeded || code !== 0) reject(new Error(exceeded ? 'Backup exceeds the supported size.' : 'Backup command failed. Check CLI login, Docker and project access from your terminal.')); else resolveResult(Buffer.concat(chunks)); });
  });
}

export async function localConfiguration() {
  const status = JSON.parse((await capture(process.execPath, [CLI,'status','-o','json'], 1024*1024)).toString());
  if (status.API_URL !== 'http://127.0.0.1:54321' || !status.SERVICE_ROLE_KEY) throw new Error('Expected running local church Supabase.');
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

export function sourceClient({ url, key }) {
  if (!['http://127.0.0.1:54321',`https://${PROJECT_REF}.supabase.co`].includes(url) || !key) throw new Error('Unexpected backup project or missing server key.');
  return createClient(url,key,{ auth: { persistSession:false, autoRefreshToken:false } });
}

export async function collectSqlDumps(remote, run = capture) {
  const base = [CLI,'db','dump',...(remote?[`--remote=${PROJECT_REF}`]:[])];
  const files=[];
  let total=0;
  for (const [path,flags] of [
    ['roles.sql',['--role-only']], ['schema.sql',[]],
    ['data.sql',['--data-only','--use-copy']],
    ['history-schema.sql',['--schema','supabase_migrations']],
    ['history-data.sql',['--schema','supabase_migrations','--data-only','--use-copy']],
  ]) {
    const bytes=await run(process.execPath,[...base,...flags],MAX_FILE_BYTES-total);
    if(!bytes.length) throw new Error('Empty database export; no archive saved.');
    total+=bytes.length;
    if(total>MAX_FILE_BYTES) throw new Error('Database export exceeds supported size.');
    files.push({path,bytes});
  }
  const data=files.find((file)=>file.path==='data.sql').bytes.toString();
  if(!/COPY\s+"?auth"?\."?users"?\s*\(/i.test(data) || !/COPY\s+"?storage"?\."?objects"?\s*\(/i.test(data)) throw new Error('Auth or photo metadata missing from database export.');
  if(!files.find((file)=>file.path==='history-data.sql').bytes.includes(Buffer.from('schema_migrations'))) throw new Error('Migration history missing from export.');
  return files;
}

async function snapshot(client) {
  const tables = {};
  let inventoryBytes=0;
  for (const [table,key] of Object.entries(TABLE_KEYS)) {
    const rows = [];
    let available=true;
    for (let offset=0;;offset+=500) {
      const result = await client.from(table).select('*').order(key).range(offset,offset+499);
      // Backups taken before the additive video migration remain supported.
      if(result.error&&['worship_videos','homepage_content'].includes(table)&&offset===0&&['PGRST205','42P01'].includes(result.error.code)){available=false;break;}
      if (result.error) throw new Error('Application inventory could not be read.');
      inventoryBytes+=Buffer.byteLength(JSON.stringify(result.data));
      if(inventoryBytes>16*1024*1024) throw new Error('Application inventory exceeds supported size.');
      rows.push(...result.data);
      if (rows.length > 100000) throw new Error('Application inventory exceeds supported size.');
      if (result.data.length < 500) break;
    }
    if(available)tables[table] = rows;
  }
  const bucket = await client.storage.getBucket('bulletin-images');
  if (bucket.error || bucket.data.public) throw new Error('Expected private bulletin-images bucket.');
  const objects = [];
  for (let offset=0;;offset+=100) {
    const result = await client.storage.from('bulletin-images').list('',{ limit:100, offset, sortBy:{column:'name',order:'asc'} });
    if (result.error) throw new Error('Photo inventory could not be read.');
    for (const file of result.data) {
      // The application only stores normalized UUID.webp files in this bucket.
      // A new directory/file convention must be supported explicitly, never skipped.
      if (!file.id || !/^[a-f0-9-]{36}\.webp$/.test(file.name)) throw new Error('Unexpected photo path; backup stopped to avoid omissions.');
      objects.push(file);
    }
    if (objects.length > 10000) throw new Error('Too many photos for this backup format.');
    if (result.data.length < 100) break;
  }
  const names = new Set(objects.map((file)=>file.name));
  if (tables.bulletin_images.some((image)=>!names.has(`${image.id}.webp`))) throw new Error('An image DB reference has no stored photo.');
  return { tables, bucket:bucket.data, objects };
}

export async function collectBackup({ local, config }) {
  if (config.url !== (local ? 'http://127.0.0.1:54321' : `https://${PROJECT_REF}.supabase.co`)) throw new Error('Backup target mismatch.');
  const client = sourceClient(config);
  const before = await snapshot(client);
  const files = [];
  let total = 0;
  const add = (path, bytes) => { total += bytes.length; if (total>MAX_FILE_BYTES) throw new Error('Backup exceeds 64 MiB. No partial archive was saved.'); files.push({path,bytes}); };
  if (local) {
    const args = ['exec','supabase_db_dreaming-good-church','pg_dump','-U','supabase_admin','-d','postgres','-Fc'];
    for (const schema of ['public','private','auth','storage','extensions','supabase_migrations']) args.push('-n',schema);
    add('database.dump',await capture('docker',args));
    add('roles.sql',await capture('docker',['exec','supabase_db_dreaming-good-church','pg_dumpall','-U','supabase_admin','--roles-only','--no-role-passwords']));
  } else {
    for(const file of await collectSqlDumps(true)) add(file.path,file.bytes);
  }
  for (const object of before.objects) {
    if (!Number.isSafeInteger(object.metadata?.size) || object.metadata.size<0 || total+object.metadata.size>MAX_FILE_BYTES) throw new Error('Photo size exceeds supported backup bounds.');
    const result = await client.storage.from('bulletin-images').download(object.name);
    if (result.error) throw new Error('Photo download failed; no archive saved.');
    const bytes = Buffer.from(await result.data.arrayBuffer());
    if (bytes.length!==object.metadata.size) throw new Error('Photo size changed during backup.');
    add(`photos/${object.name}`,bytes);
  }
  const after = await snapshot(client);
  if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Church data changed during backup. Pause editing and retry.');
  add('inventory.json',Buffer.from(JSON.stringify(before)));
  const applied=local?JSON.parse((await capture('docker',['exec','supabase_db_dreaming-good-church','psql','-U','supabase_admin','-d','postgres','-At','-c','select json_agg(version order by version) from supabase_migrations.schema_migrations;'])).toString()):appliedMigrationVersions(files.find(file=>file.path==='history-data.sql').bytes.toString());
  const included=[];
  for(const name of (await readdir('supabase/migrations')).sort()) {
    if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) throw new Error('Unexpected migration file.');
    if(!applied.includes(name.slice(0,14)))continue;
    included.push(name.slice(0,14));
    add(`migrations/${name}`,await readFile(resolve('supabase/migrations',name)));
  }
  if(JSON.stringify(included)!==JSON.stringify(applied))throw new Error('An applied migration file is missing.');
  const commit = (await capture('git',['rev-parse','HEAD'],1024)).toString().trim();
  // Include reviewed schema/rights definitions; cloud services' settings/keys are NOT copied.
  return { files, metadata:{ createdAt:new Date().toISOString(), target:local?'local':PROJECT_REF, commit,
    photoCount:before.objects.length, appRows:Object.fromEntries(Object.entries(before.tables).map(([name,rows])=>[name,rows.length])),
    scope:'Application DB + Auth data + bulletin-images metadata/files + migrations; SQL restore requires documented Supabase procedure',
    excluded:['service keys and DB passwords','Auth project configuration','Vault root encryption keys','other Storage buckets','cross-dump transaction snapshot'],
    sourceInventorySha256:sha256(Buffer.from(JSON.stringify(before))) } };
}
