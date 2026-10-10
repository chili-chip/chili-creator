// Checks the static editor without a browser:
// every local script and stylesheet in editor/index.html exists and carries
// the package version (see stamp-version.mjs), and every JavaScript file parses.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetRefs } from './asset-refs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editorDir = join(root, 'editor');
let failures = 0;

const html = readFileSync(join(editorDir, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
  if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('#') || ref === '') {
    continue;
  }
  if (!existsSync(join(editorDir, ref.split(/[?#]/)[0]))) {
    console.error(`editor/index.html references a missing file: ${ref}`);
    failures++;
  }
}

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const { ref } of assetRefs(html)) {
  if (!ref.endsWith(`?v=${version}`)) {
    console.error(`editor/index.html loads ${ref} without ?v=${version}; run npm run stamp`);
    failures++;
  }
}

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return jsFiles(path);
    }
    return name.endsWith('.js') ? [path] : [];
  });
}

for (const file of [...jsFiles(editorDir), ...jsFiles(join(root, 'citsy'))]) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    console.error(`${file.slice(root.length + 1)} does not parse:\n${error.stderr}`);
    failures++;
  }
}

if (failures) {
  console.error(`${failures} problem(s) found.`);
  process.exit(1);
}
console.log('Editor files look complete.');
