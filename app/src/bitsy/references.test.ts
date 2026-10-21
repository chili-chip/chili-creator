import { describe, expect, it } from 'vitest';
import { addRoom, byId, createWorld, parse } from '.';
import { referencesTo, search } from './references';
import { addEnding, addExit, setDialogText } from './story';
import { validate } from './validate';

const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', { query: '?raw', import: 'default', eager: true });
const fixture = (name: string) => parse(fixtures[`./fixtures/${name}.bitsy`]!).world;

const world = () => createWorld({ title: 'Test' });

describe('referencesTo', () => {
  it('finds the rooms a tile is painted in', () => {
    expect(referencesTo(world(), { type: 'drawing', kind: 'tiles', id: 'a' })).toEqual([
      { label: 'example room: 52 cells', at: { type: 'room', room: '0' } },
    ]);
  });

  it('finds where an item lies, who carries it and which dialogs check it, by id or name', () => {
    const w = world();
    w.rooms[0]!.items.push({ id: '1', x: 2, y: 3 });
    byId(w.sprites, 'a')!.inventory.push({ id: '1', count: 2 });
    setDialogText(w, '0', '{item "key"} keys');
    expect(referencesTo(w, { type: 'drawing', kind: 'items', id: '1' })).toEqual([
      { label: 'example room at 2,3', at: { type: 'room', room: '0', x: 2, y: 3 } },
      { label: 'cat carries 2', at: { type: 'drawing', kind: 'sprites', id: 'a' } },
      { label: 'cat dialog', at: { type: 'dialog', id: '0' } },
    ]);
  });

  it('finds the exits and dialogs that lead into a room', () => {
    const w = world();
    const other = addRoom(w);
    addExit(w, '0', 3, 4);
    setDialogText(w, '1', `{exit "${other}" 1 1}`);
    expect(referencesTo(w, { type: 'room', room: other })).toEqual([
      { label: 'Exit in example room at 3,4', at: { type: 'room', room: '0', x: 3, y: 4 } },
      { label: 'tea dialog', at: { type: 'dialog', id: '1' } },
    ]);
  });

  it('finds who says a dialog and which dialogs use a variable', () => {
    const w = world();
    setDialogText(w, '2', '{a = a + 1}');
    expect(referencesTo(w, { type: 'dialog', id: '0' })).toEqual([
      { label: 'cat', at: { type: 'drawing', kind: 'sprites', id: 'a' } },
    ]);
    expect(referencesTo(w, { type: 'variable', id: 'a' })).toEqual([
      { label: 'key dialog', at: { type: 'dialog', id: '2' } },
    ]);
  });

  it('finds the rooms that use a palette', () => {
    expect(referencesTo(world(), { type: 'palette', id: '0' })).toEqual([
      { label: 'example room', at: { type: 'room', room: '0' } },
    ]);
  });
});

describe('search', () => {
  it('finds drawings, rooms, dialog text and variables by name', () => {
    const w = world();
    expect(search(w, 'cat').map((r) => r.label)).toEqual(['cat', 'cat dialog']);
    expect(search(w, 'WARM')).toEqual([{ label: 'tea dialog', detail: 'You found a nice warm cup of tea', at: { type: 'dialog', id: '1' } }]);
    expect(search(w, 'example').map((r) => r.at)).toEqual([{ type: 'room', room: '0' }]);
    expect(search(w, 'a').some((r) => r.at.type === 'variable')).toBe(true);
    expect(search(w, '  ')).toEqual([]);
  });
});

describe('validate', () => {
  it('finds nothing wrong with a game that can be finished', () => {
    const w = world();
    addEnding(w, '0', 10, 10);
    expect(validate(w)).toEqual([]);
  });

  it('warns when a game has no ending and no title', () => {
    const w = world();
    w.title = '';
    expect(validate(w).map((p) => [p.severity, p.message])).toEqual([
      ['warning', 'The game has no title.'],
      ['warning', 'Players cannot finish this game yet: add an ending.'],
    ]);
  });

  it('finds broken references', () => {
    const w = world();
    addEnding(w, '0', 10, 10);
    const room = w.rooms[0]!;
    room.palette = '9';
    room.tilemap[0]![0] = 'z';
    room.items.push({ id: '7', x: 1, y: 1 });
    room.exits.push({ x: 5, y: 5, dest: { room: '4', x: 1, y: 1 } });
    room.exits.push({ x: 6, y: 5, dest: { room: '0', x: 16, y: 1 }, dialog: 'nope' });
    byId(w.sprites, 'a')!.dialog = 'gone';
    byId(w.sprites, 'a')!.inventory.push({ id: 'x', count: 1 });
    setDialogText(w, '1', '{exit "attic" 1 1}{item "spoon"}{say ghost}');
    expect(validate(w)).toEqual([
      { severity: 'error', message: 'example room uses palette 9, which does not exist.', at: { type: 'room', room: '0' } },
      { severity: 'error', message: 'example room has tile z, which does not exist.', at: { type: 'room', room: '0', x: 0, y: 0 } },
      { severity: 'error', message: 'example room has item 7, which does not exist.', at: { type: 'room', room: '0', x: 1, y: 1 } },
      { severity: 'error', message: 'The exit at 5,5 in example room leads to room 4, which does not exist.', at: { type: 'room', room: '0', x: 5, y: 5 } },
      { severity: 'error', message: 'The exit at 6,5 in example room leads off the room (16,1).', at: { type: 'room', room: '0', x: 6, y: 5 } },
      { severity: 'warning', message: 'The exit at 6,5 in example room uses dialog nope, which does not exist.', at: { type: 'room', room: '0', x: 6, y: 5 } },
      { severity: 'error', message: 'cat uses dialog gone, which does not exist.', at: { type: 'drawing', kind: 'sprites', id: 'a' } },
      { severity: 'warning', message: 'cat carries item x, which does not exist.', at: { type: 'drawing', kind: 'sprites', id: 'a' } },
      { severity: 'error', message: 'tea dialog exits to room "attic", which does not exist.', at: { type: 'dialog', id: '1' } },
      { severity: 'warning', message: 'tea dialog checks item "spoon", which does not exist.', at: { type: 'dialog', id: '1' } },
      { severity: 'warning', message: 'tea dialog reads ghost, a variable that is never set.', at: { type: 'dialog', id: '1' } },
    ]);
  });

  it('catches the exit to a missing room in the parser fixture', () => {
    // phase3.bitsy tests the parser only: its exit leads to a room it does not have.
    expect(validate(fixture('phase3')).filter((p) => p.severity === 'error').map((p) => p.message)).toEqual([
      'The exit at 15,8 in start leads to room 1, which does not exist.',
    ]);
  });

  it('finds the avatar missing from the rooms', () => {
    const w = world();
    addEnding(w, '0', 10, 10);
    delete byId(w.sprites, 'A')!.position;
    expect(validate(w)).toEqual([
      { severity: 'error', message: 'The avatar is not in any room.', at: { type: 'drawing', kind: 'sprites', id: 'A' } },
    ]);
  });

  it('passes the fixtures that ship with the editor', () => {
    for (const name of ['mossland', 'scripted', 'two_rooms']) {
      expect(validate(fixture(name)).filter((p) => p.severity === 'error'), name).toEqual([]);
    }
  });
});
