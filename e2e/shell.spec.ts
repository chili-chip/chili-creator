import { expect, test } from '@playwright/test';

test('the creator opens on its own with the projects dashboard', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('banner')).toContainText('Chili Creator');
  await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Not signed in')).toBeVisible();
  await expect(page.getByText('Standalone')).toBeVisible();
});

test('the command palette opens with Ctrl+K and resets the layout', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Commands' });
  await expect(palette).toBeVisible();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('reset');
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
});

test('the page fits a phone screen without scrolling sideways', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('banner')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe('a first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('offers a tour that opens each tool it explains, and then stays away', async ({ page }) => {
    await page.goto('/index.html');
    const tour = page.getByRole('dialog', { name: 'Tour' });
    await expect(tour.getByRole('heading', { name: 'Your tools' })).toBeVisible();
    for (let i = 0; i < 4; i++) await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour.getByRole('heading', { name: 'Play' })).toBeVisible();
    await expect(page.getByText('Open a game to play it.')).toBeVisible();
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
    await expect(tour).toBeHidden();
  });
});

test('a layout preset sets the tools up for drawing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones show one tool at a time, so they have no layouts.');
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Layout' }).selectOption('Drawing');
  const tabs = page.locator('.dv-default-tab');
  await expect(tabs).toHaveText(['Room', 'Paint', 'Library', 'Colors']);
});

test('on a phone, one tool fills the screen and the tools are along the bottom', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only phones have the bottom tool bar.');
  await page.goto('/index.html');
  const tools = page.getByRole('navigation', { name: 'Tools' });
  const bar = (await tools.boundingBox())!;
  expect(bar.y + bar.height).toBeGreaterThan(page.viewportSize()!.height - 4);
  await expect(tools.getByRole('button', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  await tools.getByRole('button', { name: 'Find' }).click();
  await expect(tools.getByRole('button', { name: 'Find' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Your games' })).toBeHidden();
});
