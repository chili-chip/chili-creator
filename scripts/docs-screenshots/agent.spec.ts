import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createFakePlatform } from '../../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from '../../e2e/fake-platform';
import { call, withModelContext } from '../../e2e/model-context';

// Screenshots for docs/get-started/ai.md: a room an agent made through the
// tools, as the editor shows it and as the agent sees it.

const out = join(__dirname, '../../docs/assets/screenshots');

test('ai agent', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withModelContext(page);
  await servePlatform(page, createFakePlatform({ token: 'docs' }));
  const creator = await openInFakePlatform(page, ['docs']);
  await expect(creator.getByRole('button', { name: 'New game' })).toBeVisible();

  await call(page, 'new_game', { engine: 'bitsy', title: 'Night Garden' });
  await call(page, 'bitsy_set_palette', { id: '0', name: 'night', colors: ['#14182e', '#3f6d4e', '#f2d16b'] });
  const flower = ['00000000', '00011000', '00100100', '00011000', '00001000', '00101000', '00011000', '00001000'];
  const { data: tile } = await call(page, 'bitsy_add_drawing', { kind: 'tiles', name: 'flower', frames: [flower] });
  const rows = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (x === 0 || y === 0 || x === 15 || y === 15 ? 'a' : (x * 7 + y * 3) % 11 === 0 ? tile.id : '0')).join(','),
  );
  await call(page, 'bitsy_set_room', { id: '0', name: 'night garden', tiles: rows });
  await call(page, 'bitsy_set_dialog', { kind: 'sprites', drawing: 'a', text: 'The flowers glow at night. Pick one for me?' });
  await call(page, 'bitsy_add_ending', { room: '0', x: 13, y: 2, text: 'You sleep among the flowers.' });

  const { images } = await call(page, 'bitsy_room_picture', { room: '0' });
  writeFileSync(join(out, 'agent-room-picture.png'), Buffer.from(images[0]!, 'base64'));
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Night Garden');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, 'agent-bitsy.png'), animations: 'disabled', caret: 'hide' });
});
