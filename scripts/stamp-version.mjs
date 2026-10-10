// Stamps the package version onto every local script and stylesheet in
// editor/index.html (`?v=0.2.1`), so a release never runs against files a
// browser cached from the one before. `npm version` runs this on its own.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetRefs } from './asset-refs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const file = join(root, 'editor', 'index.html');
const html = readFileSync(file, 'utf8');

let next = html;
for (const { attr, ref } of assetRefs(html).reverse()) {
  const stamped = `${ref.split(/[?#]/)[0]}?v=${version}`;
  next = next.slice(0, attr.index) + attr.text.replace(ref, stamped) + next.slice(attr.index + attr.text.length);
}
writeFileSync(file, next);
console.log(`Stamped editor/index.html with v=${version}.`);
