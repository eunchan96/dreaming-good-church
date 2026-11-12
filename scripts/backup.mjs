import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { mkdir, open, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { makeBundle, encryptBundle, decryptBundle, unpackNewDirectory, sha256 } from './lib/backup-archive.mjs';
import { collectBackup, localConfiguration, PROJECT_REF } from './lib/backup-source.mjs';

function hiddenInput(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run from your own interactive terminal. Passphrases cannot be passed by argument, environment variable or pipe.');
  process.stdout.write(prompt);
  return new Promise((resolveInput,reject)=>{
    const output = new Writable({ write(_chunk,_encoding,done) { done(); } });
    const rl = createInterface({ input:process.stdin, output, terminal:true, historySize:0 });
    let answered = false;
    rl.once('SIGINT',()=>rl.close());
    rl.once('close',()=>{ process.stdout.write('\n'); if(!answered) reject(new Error('Backup cancelled.')); });
    rl.question('',(value)=>{ answered=true; rl.close(); resolveInput(value); });
  });
}

export async function saveVerifiedBackup(bundle, password, outputDirectory) {
  const archive = await encryptBundle(bundle,password);
  const verified = await decryptBundle(archive,password);
  if (JSON.stringify(verified)!==JSON.stringify(bundle)) throw new Error('Backup round-trip mismatch.');
  await mkdir(outputDirectory,{ recursive:true, mode:0o700 });
  const name = `church-${bundle.metadata.target}-${new Date().toISOString().replaceAll(/[:.]/g,'-')}-${randomUUID()}.dgcb`;
  const path = join(outputDirectory,name);
  // Write exclusively. The file only appears here after encryption and verification.
  await writeFile(path,archive,{ flag:'wx', mode:0o600 });
  const saved = await readFile(path);
  const hash = sha256(saved);
  if (hash!==sha256(archive)) { await unlink(path); throw new Error('Saved backup checksum mismatch.'); }
  // Contains no password, plaintext data, SQL or key values.
  const receipt = { version:1, archive:name, sha256:hash, bytes:saved.length, target:bundle.metadata.target,
    verifiedAt:new Date().toISOString(), fileCount:bundle.files.length, photoCount:bundle.metadata.photoCount,
    archiveVerified:true, driveCopyVerified:false };
  await writeFile(`${path}.receipt.json`,JSON.stringify(receipt,null,2),{ flag:'wx', mode:0o600 });
  return {path,receipt};
}

async function boundedRead(path) {
  if ((await stat(path)).size>96*1024*1024) throw new Error('Backup file is too large.');
  return readFile(path);
}

export async function main(args) {
  const [command,...rest] = args;
  const defaultDirectory = resolve('.local/backups');
  if (command==='create') {
    if (rest.length!==1 || !['--local','--production'].includes(rest[0])) throw new Error('Choose exactly create --local or create --production.');
    const local = rest[0]==='--local';
    console.log(`Target: ${local?'local Docker':PROJECT_REF}. Pause church editing until completion. No remote restore or Drive upload will run.`);
    const password = await hiddenInput('복구 암호 (16자 이상, 화면에 표시하지 않음): ');
    if (password!==await hiddenInput('복구 암호 확인: ')) throw new Error('Recovery passphrases do not match.');
    // Validate the passphrase before collecting any sensitive data.
    if (password.length<16 || password.length>1024) throw new Error('Use a recovery passphrase of 16–1024 characters.');
    const config = local ? await localConfiguration() : { url:process.env.NEXT_PUBLIC_SUPABASE_URL, key:process.env.SUPABASE_SERVICE_ROLE_KEY };
    const collected = await collectBackup({ local, config });
    const result = await saveVerifiedBackup(makeBundle(collected.metadata,collected.files),password,defaultDirectory);
    console.log(`암호화·복호화·저장 해시 검증 완료: ${result.path}`);
    console.log(`SHA-256: ${result.receipt.sha256}`);
    console.log('PC 사본만 생성되었습니다. 복구 암호는 별도로 보관하고, Drive 업로드/재다운로드 검증을 이어서 진행하세요.');
  } else if (command==='verify' || command==='unpack') {
    if ((command==='verify' && rest.length!==1) || (command==='unpack' && (rest.length!==3 || rest[1]!=='--output'))) throw new Error('Use verify FILE or unpack FILE --output NEW_DIRECTORY.');
    const password = await hiddenInput('복구 암호: ');
    const bundle = await decryptBundle(await boundedRead(resolve(rest[0])),password);
    if (command==='unpack') {
      const output = resolve(rest[2]);
      // Only allow plaintext recovery under the ignored local directory, never a sync folder.
      const base = resolve('.local/recovery');
      if (dirname(output)!==base) throw new Error('Choose a new direct child of .local/recovery. Plaintext must not go to a shared/synced folder.');
      await mkdir(base,{recursive:true,mode:0o700});
      await unpackNewDirectory(bundle,output);
      console.log(`검증 후 새 폴더로 해제 완료: ${output}. 운영 DB 복원은 실행하지 않았습니다.`);
    } else console.log(`암호·변조·파일 해시 검증 완료 (${bundle.files.length} files).`);
  } else if (command==='check-copy') {
    if(rest.length!==2) throw new Error('Use check-copy ORIGINAL DOWNLOADED_DRIVE_COPY.');
    if(resolve(rest[0])===resolve(rest[1])) throw new Error('Choose a separately downloaded copy, not the original file.');
    const [original,copy] = await Promise.all(rest.map((path)=>boundedRead(resolve(path))));
    if(sha256(original)!==sha256(copy)) throw new Error('Drive copy does not match the local backup.');
    const receiptPath = `${resolve(rest[0])}.receipt.json`;
    const receipt = JSON.parse(await readFile(receiptPath,'utf8'));
    if(receipt.sha256!==sha256(original) || !receipt.archiveVerified) throw new Error('Local verification receipt does not match.');
    const handle = await open(receiptPath,'w',0o600);
    try { await handle.writeFile(JSON.stringify({...receipt,copyBytesVerified:true,copyVerifiedAt:new Date().toISOString()},null,2)); } finally { await handle.close(); }
    console.log('사본과 PC 원본의 SHA-256 일치. 실제 Drive 업로드·저장 위치 확인은 별도입니다.');
  } else throw new Error('Use create --local|--production, verify FILE, unpack FILE --output NEW_DIRECTORY, or check-copy ORIGINAL DOWNLOADED_DRIVE_COPY.');
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
