import { expect, test } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';
import { call, withModelContext } from './model-context';

// The tests work on games only through the tools the creator offers over
// WebMCP, as an AI agent would.

test.beforeEach(({}, info) => {
  // Agents do not care about the screen size; once is enough.
  test.skip(info.project.name === 'phone');
});

test('an agent makes a Bitsy game through the tools, and the editor shows it', async ({ page }) => {
  await withModelContext(page);
  const platform = await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token']);
  await expect(creator.getByRole('button', { name: 'New game' })).toBeVisible();

  const status = await call(page, 'creator_status');
  expect(status.data).toMatchObject({ signedIn: true, open: null });

  await call(page, 'new_game', { engine: 'bitsy', title: 'Agent game' });
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Agent game');

  const { data: room } = await call(page, 'bitsy_add_room', { name: 'garden' });
  await call(page, 'bitsy_add_exit', { room: '0', x: 14, y: 8, to: { room: room.id, x: 1, y: 8 } });
  await call(page, 'bitsy_set_dialog', { kind: 'sprites', drawing: 'a', text: 'Hello from the agent' });
  expect((await call(page, 'bitsy_room_picture', { room: room.id })).pictures).toBe(1);

  // The real citsy plays the game in the page.
  const played = await call(page, 'bitsy_play', { buttons: ['right', 'right'], waitMs: 200 });
  expect(played.data.status).toBe('playing');
  expect(played.pictures).toBe(1);

  // The person can undo what the agent did.
  await call(page, 'bitsy_set_dialog', { kind: 'sprites', drawing: 'a', text: 'Oops' });
  await call(page, 'undo');
  const { data: text } = await call(page, 'get_game_text');
  expect(text.text).toContain('Hello from the agent');

  // Autosave sends the agent's work to the platform.
  await expect.poll(() => platform.games[0]?.data ?? '').toContain('Hello from the agent');
});

test('an agent makes a Chili Beat game and wins it in the real engine', async ({ page }) => {
  await withModelContext(page);
  await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engine=beat');
  await expect.poll(async () => page.frames().some((f) => f.url().includes('/index.html'))).toBe(true);
  await expect.poll(async () => (await call(page, 'creator_status')).data.signedIn).toBe(true);

  await call(page, 'new_game', { engine: 'beat', title: 'Wall win' });
  const { data } = await call(page, 'beat_add_rule', { rule: { when: { bump: ['you', '#'] }, do: [{ win: 'You found the wall!' }] } });
  expect(data.number).toBe(2);

  const left = Array(16).fill('left');
  const played = await call(page, 'beat_play', { buttons: left, stepsAfter: 40 });
  expect(played.data).toMatchObject({ state: 'won', text: 'You found the wall!' });
  expect(played.pictures).toBe(1);
  expect((await call(page, 'list_problems')).data.problems).toEqual([]);
});
