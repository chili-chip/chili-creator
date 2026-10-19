import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test, type Route } from '@playwright/test';

// The classic editor's "load game" list (chili-creator#15). The editor is not
// part of the production build, so its files are served from the repository.
const root = resolve(__dirname, '..');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

type Game = { id: number; title: string; released: boolean; updated_at: string; owner: string };

function games(count: number, released: boolean, firstId: number): Game[] {
  return Array.from({ length: count }, (_, i) => ({
    id: firstId + i,
    title: `${released ? 'Released' : 'Draft'} ${firstId + i}`,
    released,
    owner: 'kacper',
    updated_at: new Date(Date.UTC(2026, 9, 1, 12, i)).toISOString(),
  }));
}

test('load game lists drafts past the first 20 and released games', async ({ page }) => {
  const drafts = games(25, false, 1);
  const released = games(3, true, 100);

  await page.route('**/classic/**', (route: Route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/classic/, '');
    const file = join(root, normalize(path));
    if (!file.startsWith(root)) {
      return route.fulfill({ status: 403 });
    }
    try {
      const body = readFileSync(file);
      return route.fulfill({ status: 200, body, contentType: types[extname(file)] ?? 'application/octet-stream' });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.route('**/api/profiles/me/', (route) => route.fulfill({ json: { username: 'kacper' } }));
  await page.route('**/api/games/?*', (route) => {
    const url = new URL(route.request().url());
    const source = url.searchParams.get('released') === 'false' ? drafts : released;
    const pageNo = Number(url.searchParams.get('page') ?? '1');
    const results = source.slice((pageNo - 1) * 20, pageNo * 20);
    const next = pageNo * 20 < source.length ? `${url.origin}${url.pathname}?page=${pageNo + 1}` : null;
    return route.fulfill({ json: { count: source.length, next, previous: null, results } });
  });
  await page.addInitScript(() => localStorage.setItem('chili.accessToken', 'token'));

  await page.goto('/classic/editor/index.html?api=/api');
  await page.getByRole('button', { name: 'load game', exact: false }).first().click();

  const rows = page.locator('.chili-project-row');
  await expect(rows).toHaveCount(28);
  await expect(rows.filter({ hasText: 'Draft 25' })).toHaveCount(1);
  await expect(page.locator('.chili-project-released')).toHaveCount(3);
});
