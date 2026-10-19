import { expect, test } from '@playwright/test';

test('the creator opens on its own with the Start panel', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('banner')).toContainText('Chili Creator');
  await expect(page.getByRole('heading', { name: 'The new Chili Creator' })).toBeVisible();
  await expect(page.getByText('Not signed in')).toBeVisible();
  await expect(page.getByText('Standalone')).toBeVisible();
});

test('the command palette opens with Ctrl+K and resets the layout', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('heading', { name: 'The new Chili Creator' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Commands' });
  await expect(palette).toBeVisible();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('reset');
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page.getByRole('heading', { name: 'The new Chili Creator' })).toBeVisible();
});

test('the page fits a phone screen without scrolling sideways', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('banner')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
