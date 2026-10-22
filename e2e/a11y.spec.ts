import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

const tools = ['Projects', 'Room', 'Library', 'Paint', 'Colors', 'Dialog', 'Exits & endings', 'Variables', 'Tunes', 'Blips', 'Play', 'Game', 'Find', 'Problems', 'Download'];

test('accessibility: every tool passes axe’s WCAG 2.1 AA checks', async ({ page }) => {
  const { creator } = await newGame(page);
  const nav = creator.getByRole('navigation', { name: 'Tools' });
  const found: string[] = [];
  for (const tool of tools) {
    await nav.getByRole('button', { name: tool, exact: true }).click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of results.violations) {
      found.push(`${tool}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    }
  }
  expect([...new Set(found)]).toEqual([]);
});
