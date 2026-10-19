import { expect, test } from '@playwright/test';
import { fakeProfileApi, openInFakePlatform } from './fake-platform';

test('inside the platform, the creator signs in with the token the page hands over', async ({ page }) => {
  const seen = await fakeProfileApi(page, 'host-token');
  const creator = await openInFakePlatform(page, ['host-token']);
  await expect(creator.getByText('Kacper')).toBeVisible();
  await expect(creator.getByText('In Chili Platform')).toBeVisible();
  expect(seen).toEqual(['Bearer host-token']);
  const requests = await page.evaluate(() =>
    (window as unknown as { received: { type: string; v: number }[] }).received.filter(
      (message) => message.type === 'chili-auth-request',
    ),
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]!.v).toBe(2);
});

test('when the API turns a token down, the creator asks the page for a fresh one', async ({ page }) => {
  const seen = await fakeProfileApi(page, 'fresh-token');
  const creator = await openInFakePlatform(page, ['stale-token', 'fresh-token']);
  await expect(creator.getByText('Kacper')).toBeVisible();
  expect(seen).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
  const reasons = await page.evaluate(() =>
    (window as unknown as { received: { type: string; reason?: string }[] }).received
      .filter((message) => message.type === 'chili-auth-request')
      .map((message) => message.reason ?? null),
  );
  expect(reasons).toEqual([null, 'expired']);
});

test('a signed-out platform page leaves the creator signed out', async ({ page }) => {
  const seen = await fakeProfileApi(page, 'unused');
  const creator = await openInFakePlatform(page, []);
  await expect(creator.getByRole('banner').getByText('Not signed in')).toBeVisible();
  expect(seen).toEqual([]);
});
