import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';

const derive = promisify(scrypt);
const MAGIC = Buffer.from('DGCBKP01');
const HEADER_BYTES = 36; // magic(8), random salt(16), random IV(12)
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 96 * 1024 * 1024;
const MAX_ENTRIES = 10000;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function validPath(path) {
  return typeof path === 'string' && path.length <= 200 && path.split('/').every((part) =>
    /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part) && !part.endsWith('.') &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

export function validateBundle(bundle) {
  if (bundle?.version !== 1 || !bundle.metadata || typeof bundle.metadata !== 'object' || Array.isArray(bundle.metadata) ||
      typeof bundle.metadata.target!=='string' || !/^[a-z0-9_-]{1,64}$/.test(bundle.metadata.target) ||
      !Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > MAX_ENTRIES) throw new Error('Invalid backup bundle.');
  let total = 0;
  const seen = new Set();
  for (const file of bundle.files) {
    const path = file.path;
    if (!validPath(path) || path.toLowerCase()==='backup-manifest.json' || seen.has(path.toLowerCase()) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0 ||
        typeof file.data !== 'string' || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data) ||
        !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Invalid backup entry.');
    seen.add(path.toLowerCase());
    const bytes = Buffer.from(file.data, 'base64');
    total += bytes.length;
    if (total > MAX_FILE_BYTES || bytes.length !== file.bytes || bytes.toString('base64')!==file.data || sha256(bytes) !== file.sha256) throw new Error('Backup size or checksum mismatch.');
  }
  // A file must never also be another file's parent directory.
  for (const path of seen) {
    const parts = path.split('/');
    while (parts.length > 1) { parts.pop(); if (seen.has(parts.join('/'))) throw new Error('Conflicting backup paths.'); }
  }
  return bundle;
}

export function makeBundle(metadata, files) {
  return validateBundle({ version: 1, metadata, files: files.map(({ path, bytes }) => ({
    path, bytes: bytes.length, sha256: sha256(bytes), data: bytes.toString('base64'),
  })) });
}

async function keyFor(password, salt) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 1024) throw new Error('Use a recovery passphrase of 16–1024 characters.');
  return derive(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}

export async function encryptBundle(bundle, password) {
  validateBundle(bundle);
  const plain = Buffer.from(JSON.stringify(bundle));
  if (plain.length > MAX_JSON_BYTES) throw new Error('Backup exceeds the supported size.');
  const header = Buffer.concat([MAGIC, randomBytes(16), randomBytes(12)]);
  const key = await keyFor(password, header.subarray(8,24));
  try {
    const cipher = createCipheriv('aes-256-gcm', key, header.subarray(24), { authTagLength: 16 });
    cipher.setAAD(header);
    const compressed = gzipSync(plain);
    return Buffer.concat([header, cipher.update(compressed), cipher.final(), cipher.getAuthTag()]);
  } finally { key.fill(0); plain.fill(0); }
}

export async function decryptBundle(archive, password) {
  if (!Buffer.isBuffer(archive) || archive.length < HEADER_BYTES + 17 ||
      archive.length > MAX_JSON_BYTES || !archive.subarray(0,8).equals(MAGIC)) throw new Error('Invalid or unsupported backup file.');
  const header = archive.subarray(0,HEADER_BYTES);
  const key = await keyFor(password, header.subarray(8,24));
  let compressed, plain;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(24), { authTagLength: 16 });
    decipher.setAAD(header);
    decipher.setAuthTag(archive.subarray(-16));
    // No file is written until final() has authenticated the complete payload.
    compressed = Buffer.concat([decipher.update(archive.subarray(HEADER_BYTES,-16)), decipher.final()]);
    plain = gunzipSync(compressed, { maxOutputLength: MAX_JSON_BYTES });
    return validateBundle(JSON.parse(plain.toString('utf8')));
  } catch { throw new Error('Backup verification failed: wrong passphrase, damaged file or invalid contents.'); }
  finally { key.fill(0); compressed?.fill(0); plain?.fill(0); }
}

export async function unpackNewDirectory(bundle, output) {
  validateBundle(bundle);
  const root = resolve(output);
  // Refuse existing directories, including symlinks; all parents must be trusted.
  await mkdir(root, { mode: 0o700 });
  try {
    for (const file of bundle.files) {
      const target = join(root, ...file.path.split('/'));
      const within = relative(root, target);
      if (within.startsWith('..') || isAbsolute(within)) throw new Error('Unsafe backup path.');
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, Buffer.from(file.data, 'base64'), { flag: 'wx', mode: 0o600 });
    }
    await writeFile(join(root, 'backup-manifest.json'), JSON.stringify({ version: bundle.version, metadata: bundle.metadata,
      files: bundle.files.map(({ path, bytes, sha256: hash }) => ({ path, bytes, sha256: hash })) }, null, 2), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    // root was created here; never recursively remove a caller's existing path.
    await rm(root, { recursive: true });
    throw error;
  }
  return root;
}
