import { describe, expect, it, vi } from 'vitest';
import { agentCreator } from '../../test/agent';
import { blankGame, type Game } from './model';

const engine = vi.hoisted(() => ({
  steps: [] as number[],
  error: null as string | null,
}));

vi.mock('./player', () => ({
  RPG_BUTTONS: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, x: 64, y: 128 },
  loadEngine: vi.fn(async () => ({
    load: () => engine.error,
    step: (buttons = 0) => engine.steps.push(buttons),
    debug: () => ({ state: 'playing', room: 'start', x: 6, y: 7, hp: 10, level: 1, talking: false, text: '', choices: [], flags: [], vars: {}, quests: {}, bag: [] }),
    rgba: () => new Uint8ClampedArray(128 * 128 * 4),
  })),
}));

async function open() {
  const view = await agentCreator({ data: blankGame('Quest'), search: '?engines=rpg' });
  return { ...view, game: () => view.doc<Game>() };
}

const coin = ['..4444..', '.444444.', '44c44444', '44c44444', '44444444', '44444444', '.444444.', '..4444..'];

describe('Chili RPG agent tools', () => {
  it('rpg_get_game gives the game, with pictures only when asked', async () => {
    const { call } = await open();
    const game = await call('rpg_get_game');
    expect(game).toMatchObject({ title: 'Quest', start: { room: 'start', x: 7, y: 7 }, pictureCount: 3 });
    expect(game.art).toBeUndefined();
    expect((await call('rpg_get_game', { pictures: true })).art.pictures).toHaveLength(3);
  });

  it('rpg_set_game sets the author, start, rules, hero and what happens on death', async () => {
    const { call, game } = await open();
    await call('rpg_set_game', { author: 'Ana', start: { room: 'start', x: 2, y: 3 }, rules: { bag: 8 }, player: { sprite: 1 }, stats: { atk: 3 }, lose: [{ end: 'lose' }] });
    expect(game()).toMatchObject({ author: 'Ana', start: { room: 'start', x: 2, y: 3 }, rules: { bag: 8 }, player: { sprite: 1 }, lose: [{ end: 'lose' }] });
    expect(game().stats.find((s) => s.id === 'atk')!.start).toBe(3);
    expect(await call('rpg_set_game', { start: { room: 'nowhere', x: 1, y: 1 } })).toEqual({ error: 'No room has id "nowhere".' });
  });

  it('pictures and tiles: draw a coin, make a tile of it, remove it', async () => {
    const { call, game } = await open();
    const { number } = await call('rpg_set_picture', { rows: coin });
    expect(number).toBe(3);
    expect(game().art!.pictures[3]).toEqual(coin);
    expect(await call('rpg_set_picture', { number: 3, rows: ['x'] })).toEqual({ error: 'A picture is 8 rows of 8 characters, 0 to f or ".".' });
    const { key } = await call('rpg_set_tile', { sprite: 3, solid: true });
    expect(game().tiles.find((t) => t.key === key)).toEqual({ key, sprite: 3, solid: true });
    await call('rpg_set_tile', { key, solid: null, water: true });
    expect(game().tiles.find((t) => t.key === key)).toEqual({ key, sprite: 3, water: true });
    await call('rpg_remove_tile', { key });
    expect(game().tiles.map((t) => t.key)).toEqual(['.', '#']);
  });

  it('rooms: add, paint a block, resize, rename and remove', async () => {
    const { call, game } = await open();
    const { id } = await call('rpg_add_room', { width: 20, height: 16 });
    await call('rpg_paint', { room: id, x: 1, y: 1, key: '#', width: 3, height: 2 });
    expect(game().rooms[1]!.ground.slice(1, 4)).toEqual(['.###................', '.###................', '....................']);
    await call('rpg_set_room', { id, newId: 'cave', name: 'Cave' });
    expect(game().rooms[1]).toMatchObject({ id: 'cave', name: 'Cave' });
    await call('rpg_resize_room', { id: 'cave', width: 16, height: 18 });
    expect(game().rooms[1]!.ground).toHaveLength(18);
    expect(await call('rpg_paint', { room: 'cave', x: 0, y: 0, key: '?' })).toEqual({ error: 'No tile has key "?".' });
    await call('rpg_remove_room', { id: 'cave' });
    expect(game().rooms).toHaveLength(1);
  });

  it('characters, items, dialogue and quests: set them as in the file, place them, rename and remove', async () => {
    const { call, game } = await open();
    await call('rpg_set_item', { id: 'gem', item: { name: 'Gem', icon: 1, kind: 'quest' } });
    await call('rpg_set_dialogue', { id: 'hi', dialogue: { who: 'elder', lines: [{ text: 'Find my gem.', do: [{ quest: 'gem-hunt', stage: 1 }] }] } });
    await call('rpg_set_quest', { id: 'gem-hunt', quest: { title: 'Gem hunt', stages: [{ log: 'Find the gem.', goal: { collect: 'gem' }, done: [{ end: 'win' }] }] } });
    await call('rpg_set_character', { id: 'elder', character: { name: 'Elder', sprite: 2, friendly: true, talk: 'hi' } });
    await call('rpg_place', { room: 'start', x: 3, y: 3, character: 'elder' });
    await call('rpg_place', { room: 'start', x: 10, y: 10, item: 'gem' });
    await call('rpg_place', { room: 'start', x: 1, y: 1, warp: { to: 'start', x: 5, y: 5 } });
    await call('rpg_place', { room: 'start', x: 2, y: 1, trigger: { do: [{ set: 'seen' }] } });
    expect(game().rooms[0]).toMatchObject({
      actors: [{ kind: 'elder', x: 3, y: 3 }],
      items: [{ item: 'gem', x: 10, y: 10 }],
      warps: [{ x: 1, y: 1, to: 'start', tx: 5, ty: 5 }],
      triggers: [{ x: 2, y: 1, do: [{ set: 'seen' }] }],
    });
    await call('rpg_set_character', { id: 'elder', newId: 'ana', character: { talk: null } });
    expect(game().kinds![0]).toEqual({ id: 'ana', name: 'Elder', sprite: 2, friendly: true });
    expect(game().rooms[0]!.actors![0]!.kind).toBe('ana');
    await call('rpg_clear_cell', { room: 'start', x: 10, y: 10 });
    expect(game().rooms[0]!.items).toBeUndefined();
    await call('rpg_remove_character', { id: 'ana' });
    await call('rpg_remove_item', { id: 'gem' });
    await call('rpg_remove_dialogue', { id: 'hi' });
    await call('rpg_remove_quest', { id: 'gem-hunt' });
    expect([game().kinds, game().items, game().dialogue, game().quests]).toEqual([undefined, undefined, undefined, undefined]);
    expect(await call('rpg_set_item', { id: 'Big Gem', item: {} })).toEqual({ error: 'An id is 1 to 24 lower case letters, digits, - or _.' });
  });

  it('rpg_set_slots sets the equipment slots', async () => {
    const { call, game } = await open();
    await call('rpg_set_slots', { slots: ['weapon', 'armour'] });
    expect(game().slots).toEqual(['weapon', 'armour']);
  });

  it('rpg_room_picture and rpg_set_cover show a room', async () => {
    const { call, images, creator } = await open();
    expect(await images('rpg_room_picture', { room: 'start' })).toHaveLength(1);
    await call('rpg_set_cover', {});
    const { open: state } = creator.projects.getState();
    expect(state.status === 'ready' && state.project.cover).toBeTruthy();
  });

  it('rpg_play plays the game in the real engine with button presses', async () => {
    const { call, images } = await open();
    engine.steps = [];
    const result = await call('rpg_play', { buttons: ['left', 'a'], stepsAfter: 2 });
    expect(result).toMatchObject({ state: 'playing', room: 'start', x: 6, y: 7, hp: 10 });
    expect(engine.steps).toEqual([0, 4, 0, 0, 16, 0, 0]);
    expect(await images('rpg_play', {})).toHaveLength(1);
    engine.error = 'rooms[0].actors[0].kind: no kind "slime"';
    expect(await call('rpg_play', {})).toEqual({ error: 'The engine cannot play this game: rooms[0].actors[0].kind: no kind "slime"' });
    engine.error = null;
  });
});
