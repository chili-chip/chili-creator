import { expect, test } from '@playwright/test';

// The platform serves dist/ as is, so the licences must be in the build.
test('licences: the build ships our licence, the Bitsy credits and the bundled packages’ licences', async ({ request }) => {
  const text = async (path: string) => {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    return response.text();
  };
  expect(await text('/LICENSE.txt')).toContain('Copyright (c) 2016-present, Bitsy authors');
  expect(await text('/CREDITS.md')).toContain('Adam Le Doux');
  expect(await text('/citsy-LICENSE.txt')).toContain('Copyright (c) 2026 chilichip');
  expect(await text('/THIRD-PARTY-LICENSES.md')).toContain('react');
});
