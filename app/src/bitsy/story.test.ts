import { describe, expect, it } from 'vitest';
import { addRoom, byId, createWorld, parse, serialize } from '.';
import {
  addDialog,
  addEnding,
  addExit,
  addVariable,
  dialogText,
  endingAt,
  exitAt,
  giveDialog,
  removeDialog,
  eraseMarkerAt,
  removeEndingAt,
  removeExitAt,
  removeRoom,
  removeVariable,
  renameVariable,
  setDialogText,
} from './story';

const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', { query: '?raw', import: 'default', eager: true });
const fixture = (name: string) => parse(fixtures[`./fixtures/${name}.bitsy`]!).world;

const world = () => createWorld({ title: 'Test' });

describe('dialogs', () => {
  it('adds a dialog under the next free id, also clear of ending ids', () => {
    const w = world();
    expect(addDialog(w, 'hello')).toBe('3');
    expect(dialogText(w, '3')).toBe('hello');
    const m = fixture('mossland');
    expect(addDialog(m)).toBe('1');
  });

  it('writes text over several lines with the """ wrapper', () => {
    const w = world();
    setDialogText(w, '0', 'one\n\ntwo');
    expect(byId(w.dialogs, '0')!.script).toBe('"""\none\n\ntwo\n"""');
    expect(dialogText(w, '0')).toBe('one\n\ntwo');
    const again = parse(serialize(w)).world;
    expect(dialogText(again, '0')).toBe('one\n\ntwo');
  });

  it('gives a sprite or item a dialog the first time, and keeps it after', () => {
    const w = world();
    expect(giveDialog(w, 'sprites', 'a')).toBe('0');
    const id = giveDialog(w, 'sprites', 'A');
    expect(byId(w.sprites, 'A')!.dialog).toBe(id);
    expect(byId(w.dialogs, id!)).toBeDefined();
    expect(giveDialog(w, 'tiles', 'a')).toBeNull();
  });

  it('removes a dialog and what pointed to it', () => {
    const w = world();
    removeDialog(w, '0');
    expect(byId(w.dialogs, '0')).toBeUndefined();
    expect(byId(w.sprites, 'a')!.dialog).toBeUndefined();
  });

  it('reads ending text from old END blocks too', () => {
    expect(dialogText(fixture('mossland'), '0')).toBe("it's a big world, little bug\n\ngood luck");
  });
});

describe('exits and endings', () => {
  it('adds an exit to another room at the same spot, or finds the one already there', () => {
    const w = world();
    const other = addRoom(w);
    const index = addExit(w, '0', 3, 4);
    expect(w.rooms[0]!.exits[index]).toEqual({ x: 3, y: 4, dest: { room: other, x: 3, y: 4 } });
    expect(addExit(w, '0', 3, 4)).toBe(index);
    expect(exitAt(w.rooms[0]!, 3, 4)).toBe(index);
    expect(serialize(w)).toContain(`EXT 3,4 ${other} 3,4`);
  });

  it('adds an ending with its own dialog, in place of an exit', () => {
    const w = world();
    addExit(w, '0', 3, 4);
    const id = addEnding(w, '0', 3, 4);
    expect(w.rooms[0]!.exits).toEqual([]);
    expect(endingAt(w.rooms[0]!, 3, 4)).toEqual({ id, x: 3, y: 4 });
    expect(dialogText(w, id)).toBe('The end');
    expect(serialize(w)).toContain(`END ${id} 3,4`);
  });

  it('removes exits and endings, and an ending’s text when nothing else uses it', () => {
    const w = world();
    addExit(w, '0', 1, 1);
    const id = addEnding(w, '0', 2, 2);
    expect(removeExitAt(w.rooms[0]!, 1, 1)).toBe(true);
    expect(removeEndingAt(w, '0', 2, 2)).toBe(true);
    expect(w.rooms[0]!.endings).toEqual([]);
    expect(byId(w.dialogs, id)).toBeUndefined();
    expect(removeExitAt(w.rooms[0]!, 1, 1)).toBe(false);
  });
});

describe('eraseMarkerAt', () => {
  it('takes an exit or an ending off a cell', () => {
    const w = world();
    addExit(w, '0', 1, 1);
    addEnding(w, '0', 2, 2);
    expect(eraseMarkerAt(w, '0', 1, 1)).toBe(true);
    expect(eraseMarkerAt(w, '0', 2, 2)).toBe(true);
    expect(eraseMarkerAt(w, '0', 3, 3)).toBe(false);
    expect(w.rooms[0]!.exits).toEqual([]);
    expect(w.rooms[0]!.endings).toEqual([]);
  });
});

describe('variables', () => {
  it('adds a variable under a free name, starting at 0', () => {
    const w = world();
    expect(addVariable(w)).toBe('b');
    expect(byId(w.variables, 'b')!.value).toBe('0');
  });

  it('renames a variable everywhere a dialog uses it', () => {
    const w = world();
    setDialogText(w, '0', '{a = a + 1}a cat says {say a}');
    expect(renameVariable(w, 'a', 'meows')).toBe(true);
    expect(byId(w.variables, 'meows')).toBeDefined();
    expect(dialogText(w, '0')).toBe('{meows = meows + 1}a cat says {say meows}');
  });

  it('refuses names that are taken or not names', () => {
    const w = world();
    addVariable(w);
    expect(renameVariable(w, 'a', 'b')).toBe(false);
    expect(renameVariable(w, 'a', '2 cats')).toBe(false);
    expect(renameVariable(w, 'a', 'true')).toBe(false);
    expect(byId(w.variables, 'a')).toBeDefined();
  });

  it('removes a variable', () => {
    const w = world();
    removeVariable(w, 'a');
    expect(w.variables).toEqual([]);
  });
});

describe('removeRoom', () => {
  it('removes a room, the exits to it and the sprites in it', () => {
    const w = world();
    const other = addRoom(w);
    addExit(w, '0', 3, 4);
    byId(w.sprites, 'a')!.position = { room: other, x: 1, y: 1 };
    expect(removeRoom(w, other)).toBe(true);
    expect(w.rooms.map((r) => r.id)).toEqual(['0']);
    expect(w.rooms[0]!.exits).toEqual([]);
    expect(byId(w.sprites, 'a')!.position).toBeUndefined();
  });

  it('keeps the avatar’s room', () => {
    const w = world();
    addRoom(w);
    expect(removeRoom(w, '0')).toBe(false);
  });
});
