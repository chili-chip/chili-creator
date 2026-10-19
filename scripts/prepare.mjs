// Runs as `prepare`, which npm runs when the platform installs this package
// from its git tag. It stamps the classic editor (see stamp-version.mjs) and
// builds the new creator into dist/, which the platform serves at /creator/app.
//
// Inside this repository (`npm install`, `npm ci`) both are skipped; run
// `npm run build` yourself, or `node scripts/prepare.mjs --force`.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
if (process.env.INIT_CWD === root && !force) {
  console.log('Not building or stamping inside the creator repository.');
  process.exit(0);
}

const run = (args) => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
run(['scripts/stamp-version.mjs', '--force']);
run(['node_modules/vite/bin/vite.js', 'build']);
