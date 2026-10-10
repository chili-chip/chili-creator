// Stamps the package version onto every local script and stylesheet in
// editor/index.html (`?v=0.3.0`), so a release never runs against files a
// browser cached from the one before.
//
// It runs as `prepare`, which npm runs when the platform installs this
// package from its git tag, so only the installed copy is stamped and the
// file in this repository stays plain. A `npm install` inside this repository
// runs `prepare` too and is skipped; `npm run stamp -- --force` stamps anyway.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampVersion } from './asset-refs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.INIT_CWD === root && !process.argv.includes('--force')) {
  console.log('Not stamping editor/index.html inside the creator repository.');
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const file = join(root, 'editor', 'index.html');
writeFileSync(file, stampVersion(readFileSync(file, 'utf8'), version));
console.log(`Stamped editor/index.html with v=${version}.`);
