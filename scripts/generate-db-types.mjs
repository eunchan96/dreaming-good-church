import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'gen', 'types', '--schema', 'public'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (result.status !== 0) { process.stderr.write(result.stderr || 'Local type generation failed.\n'); process.exit(1); }
if (!result.stdout.includes('export type Database')) throw new Error('Unexpected generator output; existing file preserved.');
const source = ts.createSourceFile('database.types.ts', result.stdout, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw new Error('Invalid generated TypeScript; existing file preserved.');
const content = '// Generated from the local public schema. Run npm run types:generate; do not edit.\n' + ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);
const target = new URL('../lib/database.types.ts', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== content) { console.error('DB types differ. Run npm run types:generate.'); process.exit(1); }
  console.log('Generated DB types match the local schema.');
} else { writeFileSync(target, content); console.log('Updated lib/database.types.ts from the local schema.'); }
