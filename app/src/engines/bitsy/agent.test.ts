import { describe, expect, it, vi } from 'vitest';
import { byId, readTune, startingItem, type World } from '../../bitsy';
import { agentCreator, blankGame } from '../../test/agent';

vi.mock('../../export/html', async (original) => ({
  ...(await original<typeof import('../../export/html')>()),
  loadHtmlParts: async () => ({ citsyScript: '', wasm: new Uint8Array() }),
}));

async function open() {
  return agentCreator({ data: blankGame });
}

describe('Bitsy agent tools', () => {
  it('bitsy_get_world gives a map of the whole game', async () => {
    const { call } = await open();
    const world = await call('bitsy_get_world');
    expect(world).toMatchObject({
      title: 'Test game',
      font: 'ascii_small',
      textDirection: 'LTR',
      textSize: 'default',
      start: { room: '0', x: 4, y: 4 },
      palettes: [{ id: '0', name: 'blueprint', colors: ['#0052cc', '#809fff', '#ffffff'] }],
      rooms: [{ id: '0', name: 'example room', palette: '0', tune: '2' }],
      tiles: [{ id: 'a', name: 'block', wall: false, frames: 1 }],
      variables: [{ name: 'a', value: '42' }],
    });
    expect(world.sprites).toContainEqual({ id: 'a', name: 'cat', frames: 1, dialog: '0', blip: '1', position: { room: '0', x: 8, y: 12 } });
    expect(world.items.map((i: { name: string }) => i.name)).toEqual(['tea', 'key']);
    expect(world.dialogs).toContainEqual({ id: '0', name: 'cat dialog', text: "I'm a cat" });
  });

  it('bitsy_set_game sets the font, text direction and text size', async () => {
    const { call, doc } = await open();
    await call('bitsy_set_game', { font: 'unicode_european_large', textDirection: 'RTL', textSize: 'chunky' });
    expect(doc()).toMatchObject({ defaultFont: 'unicode_european_large', textDirection: 'RTL', flags: { TXT_MODE: '1' } });
    await call('bitsy_set_game', { font: 'ascii_small' });
    expect(doc().defaultFont).toBeUndefined();
    expect(await call('bitsy_set_game', { customFont: 'not a font' })).toEqual({ error: 'customFont is not a .bitsyfont file.' });
  });

  it('palettes: add, change and remove', async () => {
    const { call, doc } = await open();
    const { id } = await call('bitsy_add_palette', { name: 'night', colors: ['#000000', '#112233', '#ffeedd'] });
    expect(byId(doc().palettes, id)).toMatchObject({ name: 'night', colors: [[0, 0, 0], [17, 34, 51], [255, 238, 221]] });
    await call('bitsy_set_palette', { id, colors: ['#ff0000', '#00ff00', '#0000ff'] });
    expect(byId(doc().palettes, id)!.colors[0]).toEqual([255, 0, 0]);
    expect(await call('bitsy_set_palette', { id, colors: ['red', '#00ff00', '#0000ff'] })).toEqual({ error: 'Colours are #rrggbb, like #ff8800. Got "red".' });
    await call('bitsy_remove_palette', { id });
    expect(doc().palettes).toHaveLength(1);
    expect(await call('bitsy_remove_palette', { id: '0' })).toEqual({ error: 'A game keeps at least one palette.' });
  });

  it('drawings: add with pixels, read, change, paint and remove', async () => {
    const { call, doc } = await open();
    const heart = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000'];
    const { id } = await call('bitsy_add_drawing', { kind: 'items', name: 'heart', frames: [heart] });
    expect(await call('bitsy_get_drawing', { kind: 'items', id })).toMatchObject({ id, name: 'heart', frames: [heart] });

    await call('bitsy_set_drawing', { kind: 'items', id, frames: [heart, heart.map((r) => r.replace(/1/g, '0'))] });
    expect(byId(doc().items, id)!.frames).toHaveLength(2);
    await call('bitsy_paint', { kind: 'items', id, frame: 1, action: 'pixel', x: 0, y: 0, value: 1 });
    expect(byId(doc().items, id)!.frames[1]![0]).toBe(1);
    await call('bitsy_paint', { kind: 'items', id, frame: 1, action: 'fill', x: 3, y: 3, value: 1 });
    expect(byId(doc().items, id)!.frames[1]!.every((p) => p === 1)).toBe(true);
    await call('bitsy_paint', { kind: 'items', id, frame: 1, action: 'clear' });
    expect(byId(doc().items, id)!.frames[1]!.every((p) => p === 0)).toBe(true);

    const tile = await call('bitsy_add_drawing', { kind: 'tiles', name: 'wall', wall: true, copyOf: 'a' });
    expect(byId(doc().tiles, tile.id)).toMatchObject({ wall: true, frames: byId(doc().tiles, 'a')!.frames });
    expect(await call('bitsy_set_drawing', { kind: 'items', id, frames: [['0']] })).toEqual({
      error: 'A frame is 8 rows of 8 digits (0 or 1).',
    });
    await call('bitsy_remove_drawing', { kind: 'items', id });
    expect(byId(doc().items, id)).toBeUndefined();
    expect(await call('bitsy_remove_drawing', { kind: 'sprites', id: 'A' })).toEqual({ error: 'The avatar (sprite A) cannot be removed.' });
  });

  it('rooms: add, read, paint tiles from rows, place and erase things', async () => {
    const { call, doc } = await open();
    const { id } = await call('bitsy_add_room', { name: 'garden' });
    const rows = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (y === 0 || x === 0 ? 'a' : '0')).join(','));
    await call('bitsy_set_room', { id, tiles: rows });
    expect(byId(doc().rooms, id)!.tilemap[0]!.every((t) => t === 'a')).toBe(true);

    await call('bitsy_place', { room: id, x: 5, y: 5, kind: 'items', id: '0' });
    await call('bitsy_place', { room: id, x: 6, y: 6, kind: 'sprites', id: 'a' });
    await call('bitsy_place', { room: id, x: 7, y: 7, kind: 'tiles', id: 'a' });
    const room = await call('bitsy_get_room', { id });
    expect(room).toMatchObject({ id, name: 'garden', items: [{ id: '0', x: 5, y: 5 }], sprites: [{ id: 'a', x: 6, y: 6 }] });
    expect(room.tiles[7].split(',')[7]).toBe('a');

    await call('bitsy_erase', { room: id, x: 6, y: 6 });
    expect(byId(doc().sprites, 'a')!.position).toBeUndefined();
    expect(await call('bitsy_place', { room: id, x: 16, y: 0, kind: 'tiles', id: 'a' })).toMatchObject({ error: expect.stringContaining('input.x') });
    expect(await call('bitsy_place', { room: id, x: 1, y: 1, kind: 'tiles', id: 'zz' })).toEqual({ error: 'No tile has id "zz".' });

    const copy = await call('bitsy_add_room', { copyOf: id });
    expect(byId(doc().rooms, copy.id)!.name).toBe('garden copy');
    expect(await call('bitsy_remove_room', { id: '0' })).toEqual({ error: 'Room "0" cannot be removed: the avatar starts there, or it is the last room.' });
    await call('bitsy_remove_room', { id: copy.id });
    expect(byId(doc().rooms, copy.id)).toBeUndefined();
  });

  it('room pictures and the cover come from the room as drawn', async () => {
    const { call, images, creator } = await open();
    const [png] = await images('bitsy_room_picture', { room: '0' });
    expect(atob(png!).slice(1, 4)).toBe('PNG');
    await call('bitsy_set_cover', {});
    const { open: state } = creator.projects.getState();
    expect(state.status === 'ready' && state.project.cover).toBeTruthy();
    await call('remove_cover');
    const after = creator.projects.getState().open;
    expect(after.status === 'ready' && after.project.cover).toBeFalsy();
  });

  it('exits and endings: add, change, lock and remove', async () => {
    const { call, doc } = await open();
    const { id: room } = await call('bitsy_add_room', { name: 'next' });
    await call('bitsy_add_exit', { room: '0', x: 14, y: 8, to: { room, x: 1, y: 8 }, transition: 'fade_w' });
    expect(byId(doc().rooms, '0')!.exits).toEqual([{ x: 14, y: 8, dest: { room, x: 1, y: 8 }, transition: 'fade_w' }]);
    expect(byId(doc().rooms, room)!.exits).toEqual([{ x: 1, y: 8, dest: { room: '0', x: 14, y: 8 } }]);

    await call('bitsy_set_exit', { room: '0', x: 14, y: 8, twoWay: false, dialog: 'lock', transition: null });
    const exit = byId(doc().rooms, '0')!.exits[0]!;
    expect(exit.transition).toBeUndefined();
    expect(exit.dialog).toBeDefined();
    expect(byId(doc().rooms, room)!.exits).toEqual([]);

    const { id: ending } = await call('bitsy_add_ending', { room, x: 8, y: 8, text: 'You made it home.' });
    expect(await call('bitsy_get_dialog', { id: ending })).toEqual({ id: ending, text: 'You made it home.' });
    await call('bitsy_remove_ending', { room, x: 8, y: 8 });
    expect(byId(doc().rooms, room)!.endings).toEqual([]);
    await call('bitsy_remove_exit', { room: '0', x: 14, y: 8 });
    expect(byId(doc().rooms, '0')!.exits).toEqual([]);
    expect(await call('bitsy_remove_exit', { room: '0', x: 1, y: 1 })).toEqual({ error: 'There is no exit at 1,1 in room "0".' });
  });

  it('dialog: write it for a sprite, by id, or as a new dialog', async () => {
    const { call, doc } = await open();
    await call('bitsy_set_dialog', { kind: 'sprites', drawing: 'a', text: '{sequence\n  - Meow.\n  - Purr.\n}' });
    expect(await call('bitsy_get_dialog', { kind: 'sprites', drawing: 'a' })).toEqual({ id: '0', text: '{sequence\n  - Meow.\n  - Purr.\n}' });
    const { id } = await call('bitsy_set_dialog', { text: 'Hello', name: 'greeting' });
    expect(byId(doc().dialogs, id)!.name).toBe('greeting');
    await call('bitsy_set_dialog', { id, text: 'Hi again' });
    expect(await call('bitsy_get_dialog', { id })).toEqual({ id, text: 'Hi again' });
    await call('bitsy_remove_dialog', { id });
    expect(byId(doc().dialogs, id)).toBeUndefined();
    expect(await call('bitsy_set_dialog', { kind: 'tiles', drawing: 'a', text: 'x' })).toEqual({ error: 'Only sprites and items have dialog.' });
  });

  it('variables and the starting inventory', async () => {
    const { call, doc } = await open();
    await call('bitsy_set_variable', { name: 'coins', value: '0' });
    await call('bitsy_set_variable', { name: 'a', value: '7' });
    expect(doc().variables.map((v) => [v.id, v.value])).toEqual([['a', '7'], ['coins', '0']]);
    await call('bitsy_rename_variable', { from: 'coins', to: 'gold' });
    expect(byId(doc().variables, 'gold')).toBeDefined();
    expect(await call('bitsy_rename_variable', { from: 'gold', to: 'else' })).toEqual({ error: '"else" cannot be a variable name, or it is taken.' });
    await call('bitsy_remove_variable', { name: 'gold' });
    expect(byId(doc().variables, 'gold')).toBeUndefined();
    await call('bitsy_set_starting_item', { item: '1', count: 2 });
    expect(startingItem(doc(), '1')).toBe(2);
  });

  it('tunes: add, write notes and settings, and play in a room', async () => {
    const { call, doc } = await open();
    const { id } = await call('bitsy_add_tune', {});
    const tune = await call('bitsy_get_tune', { id });
    expect(tune).toMatchObject({ id, tempo: 'MED', key: 'major', melody: expect.any(Array) });
    const bar = Array.from({ length: 16 }, (_, i) => (i === 0 ? { beats: 4, note: 0, octave: 4 } : { beats: 0, note: 0, octave: 4 }));
    await call('bitsy_set_tune', { id, name: 'theme', tempo: 'FST', key: 'minor', instrumentA: 'P8', arpeggio: 'UP', melody: [bar], harmony: [bar] });
    const written = readTune(byId(doc().tunes, id)!);
    expect(written).toMatchObject({ name: 'theme', tempo: 'FST', instrumentA: 'P8', arpeggio: 'UP' });
    expect(written.melody).toHaveLength(1);
    expect(written.melody[0]![0]).toEqual({ beats: 4, note: 0, octave: 4 });
    expect(await call('bitsy_set_tune', { id, melody: [bar], harmony: [] })).toEqual({ error: 'melody and harmony need the same number of bars (1 to 16).' });
    await call('bitsy_set_room', { id: '0', tune: id });
    expect(byId(doc().rooms, '0')!.tune).toBe(id);
    await call('bitsy_remove_tune', { id });
    expect(byId(doc().rooms, '0')!.tune).toBeUndefined();
  });

  it('blips: make one of a kind, change it and give it to a sprite', async () => {
    const { call, doc } = await open();
    const { id } = await call('bitsy_add_blip', { kind: 'magic' });
    const before = await call('bitsy_get_blip', { id });
    await call('bitsy_change_blip', { id, name: 'sparkle', transpose: 12, repeat: true, instrument: 'P8' });
    const after = await call('bitsy_get_blip', { id });
    expect(after).toMatchObject({ name: 'sparkle', repeat: true, instrument: 'P8' });
    expect(after.pitches).not.toEqual(before.pitches);
    await call('bitsy_set_drawing', { kind: 'sprites', id: 'a', blip: id });
    expect(byId(doc().sprites, 'a')!.blip).toBe(id);
    await call('bitsy_remove_blip', { id });
    expect(byId(doc().blips, id)).toBeUndefined();
  });

  it('find and where_used search the game', async () => {
    const { call } = await open();
    expect((await call('bitsy_find', { query: 'cat' })).results).toContainEqual(expect.objectContaining({ label: 'cat', at: { type: 'drawing', kind: 'sprites', id: 'a' } }));
    expect((await call('bitsy_where_used', { kind: 'tiles', id: 'a' })).uses).toContainEqual(expect.objectContaining({ at: { type: 'room', room: '0' } }));
  });

  it('bitsy_play plays the game, presses buttons and sends back the screen and state', async () => {
    const { call, images, player } = await open();
    const playing = call('bitsy_play', { buttons: ['right', 'ok'], waitMs: 1 });
    await vi.waitFor(() => expect(player.played).toHaveLength(1));
    player.paint(new Uint8ClampedArray(128 * 128 * 4).fill(255));
    player.setGameState({ inventory: { '1': 1 }, variables: { a: 42 } });
    expect(await playing).toEqual({ status: 'playing', inventory: { '1': 1 }, variables: { a: 42 } });
    expect(player.pressed).toEqual([[3, true], [3, false], [4, true], [4, false]]);
    expect(player.dispose).toHaveBeenCalled();
    const shot = images('bitsy_play', { waitMs: 1 });
    await vi.waitFor(() => expect(player.played).toHaveLength(2));
    player.paint(new Uint8ClampedArray(128 * 128 * 4));
    expect(await shot).toHaveLength(1);
  });

  it('bitsy_download_web_page makes the page the Download tool makes', async () => {
    const { call, download } = await open();
    expect(await call('bitsy_download_web_page', { pageColor: '#222222', size: 512 })).toEqual({ ok: true, fileName: 'Test game.html' });
    expect(download).toHaveBeenCalledWith('Test game.html', expect.stringContaining('#222222'), 'text/html');
  });

  it('Bitsy tools refuse to run on a Chili Beat game', async () => {
    const { call } = await agentCreator();
    await call('new_game', { engine: 'beat' });
    expect(await call('bitsy_get_world')).toEqual({ error: 'The open game is a Chili Beat game. These tools are for Bitsy games.' });
  });

  it('each change is one undo step', async () => {
    const { call, doc } = await open();
    await call('bitsy_add_room', {});
    await call('undo');
    expect((doc() as World).rooms).toHaveLength(1);
  });
});
