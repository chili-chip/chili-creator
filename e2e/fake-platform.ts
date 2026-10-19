import type { Page, Route } from '@playwright/test';

/**
 * A stand-in for the platform's /creator page: an iframe on the same origin
 * that answers the creator's token requests like CreatorComponent does, and
 * records every message the creator sends.
 */
export async function openInFakePlatform(page: Page, tokens: string[]) {
  const html = `<!doctype html>
<html><body style="margin:0">
<iframe id="creator" src="/index.html?api=/api" style="border:0;width:100vw;height:100vh"></iframe>
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

/** Serves GET /api/profiles/me/ for one accepted token; 401 for anything else. */
export async function fakeProfileApi(page: Page, acceptedToken: string) {
  const seen: (string | null)[] = [];
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
