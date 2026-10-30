// Bundles and runs the headless simulation tests (no browser needed).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(tmpdir(), 'project-hotel-tests');
mkdirSync(out, { recursive: true });
let failed = false;
for (const t of ['mechanics-test', 'sim-test']) {
  const file = join(out, t + '.mjs');
  await build({ entryPoints: [join(root, 'tests', t + '.ts')], bundle: true, platform: 'node', format: 'esm', outfile: file, logLevel: 'warning' });
  console.log(`\n=== ${t} ===`);
  try {
    execFileSync(process.execPath, [file], { stdio: 'inherit' });
  } catch {
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
