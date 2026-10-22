import { describe, expect, it } from 'vitest';
import { byId, createWorld, parse, serialize } from '.';

// citsy's tests/data fixtures (chili-chip/citsy 38dc742) and the classic
// editor's built-in games (its script/generated/resources.js).
const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function fixture(name: string): string {
  const text = fixtures[`./fixtures/${name}.bitsy`];
  if (text === undefined) throw new Error(`missing fixture ${name}`);
  return text;
}

describe('round trip', () => {
  const names = Object.keys(fixtures);

  it('has the fixtures', () => {
    expect(names.length).toBeGreaterThanOrEqual(11);
  });

  it.each(names)('%s serializes back byte for byte', (name) => {
    const text = fixtures[name]!;
    const { world, issues } = parse(text);
    expect(issues).toEqual([]);
    expect(serialize(world)).toBe(text);
  });

  it('keeps Windows line endings', () => {
    const text = fixture('minimal').replace(/\n/g, '\r\n');
    expect(serialize(parse(text).world)).toBe(text);
  });

  it('serializes a deep copy the same way (no hidden state)', () => {
    const text = fixture('mossland');
    const copy = structuredClone(parse(text).world);
    expect(serialize(copy)).toBe(text);
  });
});

describe('parse', () => {
  it('reads the title from the first line', () => {
    expect(parse(fixture('editor-default')).world.title).toBe("Write your game's title here");
    expect(parse(fixture('mossland')).world.title).toBe('mossland');
  });

  it('reads a NAME title when the file starts with a comment (citsy fixtures)', () => {
    expect(parse(fixture('scripted')).world.title).toBe('scripted');
  });

  it('reads flags, palettes and settings', () => {
    const { world } = parse(fixture('phase3'));
    expect(world.flags).toEqual({ ROOM_FORMAT: '1', TXT_MODE: '0' });
    expect(world.textDirection).toBe('LTR');
    expect(world.palettes).toEqual([
      {
        id: '0',
        name: 'day',
        colors: [
          [20, 20, 40],
          [180, 200, 255],
          [255, 255, 255],
        ],
        extra: [],
      },
    ]);
  });

  it('reads rooms with exits, items, endings and settings', () => {
    const { world } = parse(fixture('phase3'));
    const room = byId(world.rooms, '0')!;
    expect(room.name).toBe('start');
    expect(room.tilemap).toHaveLength(16);
    expect(room.tilemap.every((row) => row.length === 16)).toBe(true);
    expect(room.palette).toBe('0');
    expect(room.avatar).toBe('A');
    expect(room.tune).toBe('1');
    expect(room.exits).toEqual([
      { x: 15, y: 8, dest: { room: '1', x: 0, y: 8 }, transition: 'fade_w' },
    ]);
    expect(room.items).toEqual([{ id: '0', x: 6, y: 4 }]);

    const scripted = byId(parse(fixture('scripted')).world.rooms, '0')!;
    expect(scripted.endings).toEqual([{ id: '0', x: 3, y: 4 }]);
  });

  it('reads tile ids from the map', () => {
    const room = byId(parse(fixture('mossland')).world.rooms, '0')!;
    expect(room.tilemap[2]!.slice(6, 10)).toEqual(['m', 'm', 'm', 'm']);
  });

  it('reads drawings with animation frames, walls and colours', () => {
    const { world } = parse(fixture('phase3'));
    const tile = byId(world.tiles, 'b')!;
    expect(tile.name).toBe('blink');
    expect(tile.wall).toBe(true);
    expect(tile.frames).toHaveLength(2);
    expect(tile.frames[0]).toEqual(new Array(64).fill(1));
    expect(tile.frames[1]!.slice(8, 16)).toEqual([0, 1, 1, 1, 1, 1, 1, 0]);

    const colored = parse(fixture('mossland')).world.tiles.find((t) => t.color !== undefined);
    expect(colored?.color).toBeTypeOf('number');
  });

  it('reads sprites with position, dialog and blip', () => {
    const { world } = parse(fixture('editor-default'));
    const avatar = byId(world.sprites, 'A')!;
    expect(avatar.position).toEqual({ room: '0', x: 4, y: 4 });
    const cat = byId(world.sprites, 'a')!;
    expect(cat).toMatchObject({ name: 'cat', dialog: '0', blip: '1', position: { room: '0', x: 8, y: 12 } });
  });

  it('reads items, dialogs and variables', () => {
    const { world } = parse(fixture('editor-default'));
    expect(byId(world.items, '1')).toMatchObject({ name: 'key', dialog: '2', blip: '2' });
    expect(byId(world.dialogs, '2')).toEqual({
      id: '2',
      name: 'key dialog',
      script: 'A key! {wvy}What does it open?{wvy}',
    });
    expect(world.variables).toEqual([{ id: 'a', value: '42', extra: [] }]);
  });

  it('reads multi-line dialog scripts', () => {
    const { world } = parse(fixture('scripted'));
    const guard = byId(world.dialogs, 'DLG_GUARD')!;
    expect(guard.script.split('\n')[0]).toBe('{met = 1}');
    expect(guard.script.split('\n')).toHaveLength(7);
  });

  it('reads legacy endings', () => {
    const { world } = parse(fixture('scripted'));
    expect(world.endings).toEqual([{ id: '0', name: 'escape', script: 'You found the way out.' }]);
  });

  it('keeps tunes and blips as named raw blocks', () => {
    const { world } = parse(fixture('phase3'));
    expect(world.tunes).toEqual([
      expect.objectContaining({ id: '1', name: 'stroll' }),
    ]);
    expect(world.blips[0]).toMatchObject({ id: '1', name: 'pickup' });
    expect(world.blips[0]!.lines[0]).toBe('C5,E5,G5');
  });

  it('reads the old room format without commas', () => {
    const text = [
      'old',
      '',
      ...['PAL 0', '0,0,0', '255,255,255', '255,255,255'],
      '',
      'ROOM 0',
      ...Array.from({ length: 16 }, (_, y) => (y === 1 ? '0aa0000000000000' : '0000000000000000')),
      'SPR b 3,4',
      '',
    ].join('\n');
    const { world } = parse(text);
    expect(byId(world.rooms, '0')!.tilemap[1]!.slice(0, 4)).toEqual(['0', 'a', 'a', '0']);
    expect(serialize(world)).toBe(text);
  });

  it('reports a broken drawing instead of throwing', () => {
    const { issues } = parse('t\n\nTIL a\n0101\n\n');
    expect(issues).toEqual([{ line: 3, message: 'TIL a: drawing needs 8 rows of 8 pixels' }]);
  });
});

describe('serialize after edits', () => {
  it('rewrites only what changed', () => {
    const text = fixture('editor-default');
    const { world } = parse(text);
    const room = byId(world.rooms, '0')!;
    room.tilemap[2]![2] = 'a';
    const out = serialize(world);
    expect(out).toBe(text.replace('0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0', '0,a,a,0,0,0,0,0,0,0,0,0,0,0,a,0'));
  });

  it('writes a changed entity in the editor’s order', () => {
    const text = fixture('phase3');
    const { world } = parse(text);
    byId(world.rooms, '0')!.name = 'first';
    const block = serialize(world).split('\n\n').find((part) => part.startsWith('ROOM 0'))!;
    // Bitsy writes NAME, ITM, EXT, PAL, AVA, TUNE after the map.
    expect(block.split('\n').slice(17)).toEqual([
      'NAME first',
      'ITM 0 6,4',
      'EXT 15,8 1 0,8 FX fade_w',
      'PAL 0',
      'AVA A',
      'TUNE 1',
    ]);
  });

  it('adds a new tile after the last tile', () => {
    const { world } = parse(fixture('editor-default'));
    world.tiles.push({ id: 'b', name: 'floor', frames: [new Array(64).fill(0)], extra: [] });
    const out = serialize(world);
    const tile = ['TIL b', ...new Array(8).fill('00000000'), 'NAME floor'].join('\n');
    expect(out).toContain(`NAME block\n\n${tile}\n\nSPR A`);
    expect(parse(out).world.tiles.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('drops a removed dialog with its blank line', () => {
    const text = fixture('editor-default');
    const { world } = parse(text);
    world.dialogs = world.dialogs.filter((dialog) => dialog.id !== '1');
    expect(serialize(world)).toBe(text.replace('DLG 1\nYou found a nice warm cup of tea\nNAME tea dialog\n\n', ''));
  });

  it('changes a flag in place and adds new flags after the others', () => {
    const text = fixture('editor-default');
    const { world } = parse(text);
    world.flags.TXT_MODE = '1';
    world.flags.EXTRA = '2';
    expect(serialize(world)).toBe(text.replace('! TXT_MODE 0\n', '! TXT_MODE 1\n! EXTRA 2\n'));
  });

  it('writes a changed title', () => {
    const text = fixture('editor-default');
    const { world } = parse(text);
    world.title = 'Moss and tea';
    expect(serialize(world)).toBe(text.replace("Write your game's title here", 'Moss and tea'));
  });
});

describe('createWorld', () => {
  it('starts a playable game that round-trips', () => {
    const world = createWorld({ title: 'New game' });
    expect(world.title).toBe('New game');
    expect(world.rooms).toHaveLength(1);
    expect(byId(world.sprites, 'A')?.position).toEqual({ room: '0', x: 4, y: 4 });
    const text = serialize(world);
    expect(serialize(parse(text).world)).toBe(text);
    expect(text.startsWith('New game\n\n# BITSY VERSION 8.12\n')).toBe(true);
  });
});
