// Runs as `prepare`, which npm runs when the platform installs this package
// from its git tag. It builds the creator into dist/, which the platform
// serves at /creator/app.
//
// Inside this repository (`npm install`, `npm ci`) it is skipped; run
// `npm run build` yourself, or `node scripts/prepare.mjs --force`.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
if (process.env.INIT_CWD === root && !force) {
  console.log('Not building inside the creator repository.');
  process.exit(0);
}

execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: root, stdio: 'inherit' });
