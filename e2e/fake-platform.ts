import type { Page, Route } from '@playwright/test';
import { createFakePlatform, type FakePlatform } from '../app/src/chili-api/fake-platform';

/**
 * A stand-in for the platform's /creator page: an iframe on the same origin
 * that answers the creator's token requests like CreatorComponent does, and
 * records every message the creator sends.
 */
export async function openInFakePlatform(page: Page, tokens: string[], src = '/index.html?api=/api') {
  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
<iframe id="creator" src="${src}" style="border:0;width:100vw;height:100vh"></iframe>
<script>
  window.received = [];
  const tokens = ${JSON.stringify(tokens)};
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    window.received.push(event.data);
    if (event.data && event.data.type === 'chili-auth-request') {
      const access = tokens.shift();
      event.source.postMessage(
        access ? { type: 'chili-auth', v: 2, id: event.data.id, access }
               : { type: 'chili-auth', v: 2, id: event.data.id, signedOut: true },
        location.origin,
      );
    }
  });
</script>
</body></html>`;
  await page.route('**/__platform.html', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html }),
  );
  await page.goto('/__platform.html');
  return page.frameLocator('#creator');
}

/** What the creator posted to the fake platform page. */
export function received<T = { type: string }>(page: Page): Promise<T[]> {
  return page.evaluate(() => (window as unknown as { received: unknown[] }).received) as Promise<T[]>;
}

/** Serves /api/ from the in-memory platform the unit tests use. */
export async function servePlatform(page: Page, platform: FakePlatform = createFakePlatform()) {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const body = request.postData();
    const response = await platform.handle(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        ...(body !== null ? { body } : {}),
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: { 'content-type': 'application/json' },
      body: await response.text(),
    });
  });
  return platform;
}

/** Serves GET /api/profiles/me/ for one accepted token; 401 for anything else. Lists are empty. */
export async function fakeProfileApi(page: Page, acceptedToken: string) {
  const seen: (string | null)[] = [];
  await page.route('**/api/games/**', (route: Route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  );
  await page.route('**/api/profiles/me/', (route: Route) => {
    const auth = route.request().headers()['authorization'] ?? null;
    seen.push(auth);
    if (auth === `Bearer ${acceptedToken}`) {
      return route.fulfill({ json: { username: 'kacper', display_name: 'Kacper' } });
    }
    return route.fulfill({ status: 401, json: { detail: 'Token is invalid or expired' } });
  });
  return seen;
}
