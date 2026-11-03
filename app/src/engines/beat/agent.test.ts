import { describe, expect, it, vi } from 'vitest';
import { agentCreator } from '../../test/agent';
import { blankGame, type Game } from './model';

const engine = vi.hoisted(() => ({
  loaded: [] as string[],
  steps: [] as number[],
  error: null as string | null,
}));

vi.mock('./player', () => ({
  BEAT_BUTTONS: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32 },
  loadEngine: vi.fn(async () => ({
    load: (text: string) => {
      engine.loaded.push(text);
      return engine.error;
    },
    step: (buttons = 0) => engine.steps.push(buttons),
    debug: () => ({ state: 'won', screen: 'start', beat: 3, counters: [2], fired: [1], sounds: [], text: 'You win!' }),
    rgba: () => new Uint8ClampedArray(128 * 128 * 4),
    restart: vi.fn(),
  })),
}));

async function open() {
  const view = await agentCreator({ data: blankGame('Bees') });
  return { ...view, game: () => view.doc<Game>() };
}

describe('Chili Beat agent tools', () => {
  it('beat_get_game gives the game with numbered rules', async () => {
    const { call } = await open();
    const game = await call('beat_get_game');
    expect(game).toMatchObject({ title: 'Bees', time: 'beat', start: 'start' });
    expect(game.rules[0]).toMatchObject({ number: 1, when: { press: 'arrow' } });
  });

  it('beat_set_game sets colours, tempo, time and the start screen', async () => {
    const { call, game } = await open();
    await call('beat_set_game', { palette: [0, 4, 9, 12], tempo: 6, time: 'turns', author: 'Kacper' });
    expect(game()).toMatchObject({ palette: [0, 4, 9, 12], tempo: 6, time: 'turns', author: 'Kacper' });
    expect(await call('beat_set_game', { start: 'nowhere' })).toEqual({ error: 'No screen has id "nowhere".' });
  });

  it('counters: add, change and remove', async () => {
    const { call, game } = await open();
    const { id } = await call('beat_add_counter', { name: 'Coins', icon: '#', start: 3 });
    expect(game().counters).toEqual([{ id, name: 'Coins', icon: '#', start: 3 }]);
    await call('beat_set_counter', { id, start: 5 });
    expect(game().counters![0]!.start).toBe(5);
    await call('beat_remove_counter', { id });
    expect(game().counters).toEqual([]);
  });

  it('things: add with a picture, rekey, and remove', async () => {
    const { call, game } = await open();
    const coin = ['00000000', '00111100', '01222210', '01233210', '01233210', '01222210', '00111100', '00000000'];
    const { key } = await call('beat_add_thing', { name: 'Coin', frames: [coin] });
    expect(game().things.find((t) => t.key === key)).toEqual({ key, name: 'Coin', frames: [coin] });
    await call('beat_set_thing', { key, newKey: 'c', you: false, name: 'Gold' });
    expect(game().things.find((t) => t.key === 'c')!.name).toBe('Gold');
    expect(await call('beat_set_thing', { key: 'c', frames: [['0123']] })).toEqual({ error: 'A frame is 8 rows of 8 digits (0 to 3).' });
    await call('beat_remove_thing', { key: 'c' });
    expect(game().things.some((t) => t.key === 'c')).toBe(false);
  });

  it('screens: add, paint, set rows and tune, and remove', async () => {
    const { call, game } = await open();
    const { id } = await call('beat_add_screen', { x: 1, y: 0 });
    await call('beat_paint', { screen: id, x: 2, y: 3, key: '#' });
    expect(game().screens.find((s) => s.id === id)!.things[3]).toBe('..#.............');
    await call('beat_paint', { screen: id, layer: 'ground', x: 0, y: 0, key: '#' });
    expect(game().screens.find((s) => s.id === id)!.ground![0]).toBe('#...............');
    const rows = Array(16).fill('#'.repeat(16));
    const { id: tune } = await call('beat_add_tune', {});
    await call('beat_set_screen', { id, things: rows, ground: null, tune, reset: true, newId: 'cave' });
    expect(game().screens.find((s) => s.id === 'cave')).toMatchObject({ things: rows, tune, reset: true });
    expect(game().screens.find((s) => s.id === 'cave')!.ground).toBeUndefined();
    expect(await call('beat_set_screen', { id: 'cave', things: ['#'] })).toEqual({ error: 'A screen is 16 rows of 16 thing keys, "." for empty.' });
    expect(await call('beat_paint', { screen: 'cave', x: 0, y: 0, key: 'Z' })).toEqual({ error: 'No thing has key "Z".' });
    await call('beat_remove_screen', { id: 'cave' });
    expect(game().screens.map((s) => s.id)).toEqual(['start']);
  });

  it('rules: add, change, move and remove cards by number', async () => {
    const { call, game } = await open();
    const win = { when: { bump: ['you', '#'] }, do: [{ win: 'Home!' }] };
    expect(await call('beat_add_rule', { rule: win })).toEqual({ ok: true, number: 2 });
    await call('beat_add_rule', { rule: { when: { start: true }, do: [{ say: 'Go!' }] }, at: 1 });
    expect(game().rules.map((r) => Object.keys(r.when)[0])).toEqual(['start', 'press', 'bump']);
    await call('beat_set_rule', { number: 3, rule: { ...win, if: [{ chance: 50 }] } });
    expect(game().rules[2]!.if).toEqual([{ chance: 50 }]);
    await call('beat_move_rule', { number: 3, to: 1 });
    expect(Object.keys(game().rules[0]!.when)).toEqual(['bump']);
    await call('beat_remove_rule', { number: 1 });
    expect(game().rules).toHaveLength(2);
    expect(await call('beat_add_rule', { rule: { when: { jump: true }, do: [] } })).toEqual({
      error: 'rule.when must be one of: start, press, bump, every, counter.',
    });
    expect(await call('beat_add_rule', { rule: { when: { start: true }, do: [{ fly: 'up' }] } })).toEqual({
      error: 'rule.do[0] must be one of: move, turn, become, vanish, make, count, say, sound, go, shake, win, lose.',
    });
    expect(await call('beat_remove_rule', { number: 9 })).toEqual({ error: 'There is no rule 9. The game has 2 rules.' });
  });

  it('sounds and tunes: add, change, rename and remove', async () => {
    const { call, game } = await open();
    const { id } = await call('beat_add_sound', { preset: 'coin', pitch: 6 });
    expect(game().blips!.find((b) => b.id === id)).toMatchObject({ preset: 'coin', pitch: 6 });
    await call('beat_set_sound', { id, newId: 'ding', length: 5 });
    expect(game().blips!.find((b) => b.id === 'ding')).toMatchObject({ length: 5 });
    await call('beat_remove_sound', { id: 'ding' });
    expect(game().blips).toEqual([]);
    const tune = await call('beat_add_tune', { scale: 'minor' });
    const lead = Array.from({ length: 16 }, (_, i) => i % 8);
    await call('beat_set_tune', { id: tune.id, lead });
    expect(game().tunes![0]).toMatchObject({ scale: 'minor', lead });
    expect(await call('beat_set_tune', { id: tune.id, lead: [1] })).toMatchObject({ error: expect.stringContaining('input.lead') });
    await call('beat_remove_tune', { id: tune.id });
    expect(game().tunes).toEqual([]);
  });

  it('pictures and the cover come from a screen as it starts', async () => {
    const { call, images, creator } = await open();
    expect(await images('beat_screen_picture', { screen: 'start' })).toHaveLength(1);
    await call('beat_set_cover', {});
    const { open: state } = creator.projects.getState();
    expect(state.status === 'ready' && state.project.cover).toBeTruthy();
  });

  it('beat_play plays the game in the real engine with button presses', async () => {
    const { call, images } = await open();
    engine.steps = [];
    const result = await call('beat_play', { buttons: ['left', 'a'], stepsAfter: 2 });
    expect(result).toEqual({ state: 'won', screen: 'start', beat: 3, counters: [2], firedRules: [2], text: 'You win!' });
    expect(engine.steps).toEqual([0, 4, 0, 0, 16, 0, 0]);
    expect(await images('beat_play', {})).toHaveLength(1);
    engine.error = 'rules[0].do[0].become: no thing has key "z"';
    expect(await call('beat_play', {})).toEqual({ error: 'The engine cannot play this game: rules[0].do[0].become: no thing has key "z"' });
    engine.error = null;
  });
});
