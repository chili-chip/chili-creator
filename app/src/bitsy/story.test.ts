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
  returnExitOf,
  reverseExit,
  setDialogText,
  setExitDest,
  setExitDialog,
  setTwoWay,
  setStartingItem,
  startingItem,
  moveExit,
  removeExit,
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

describe('two-way exits', () => {
  /** Room 0 and a second room, with a two-way exit at 3,4 between them. */
  function linked() {
    const w = world();
    const other = addRoom(w);
    const index = addExit(w, '0', 3, 4);
    return { w, other, index, room: w.rooms[0]!, dest: byId(w.rooms, other)! };
  }

  it('adds the way back too, like the Bitsy editor', () => {
    const { w, other, dest } = linked();
    expect(dest.exits).toEqual([{ x: 3, y: 4, dest: { room: '0', x: 3, y: 4 } }]);
    expect(returnExitOf(w, '0', 0)).toEqual({ room: other, index: 0 });
    expect(serialize(w)).toContain(`EXT 3,4 0 3,4`);
  });

  it('adds only one way when asked, or when the way back has no free cell', () => {
    const w = world();
    const other = addRoom(w);
    addEnding(w, other, 5, 5);
    addExit(w, '0', 1, 1, { twoWay: false });
    addExit(w, '0', 5, 5);
    expect(byId(w.rooms, other)!.exits).toEqual([]);
    expect(returnExitOf(w, '0', 0)).toBeUndefined();
    // With one room, an exit leads to its own cell: no way back on top of it.
    const lonely = world();
    addExit(lonely, '0', 2, 2);
    expect(lonely.rooms[0]!.exits).toHaveLength(1);
  });

  it('makes an exit one-way or two-way, and turns a one-way exit around', () => {
    const { w, other, room, dest } = linked();
    setTwoWay(w, '0', 0, false);
    expect(dest.exits).toEqual([]);
    setTwoWay(w, '0', 0, true);
    expect(dest.exits).toEqual([{ x: 3, y: 4, dest: { room: '0', x: 3, y: 4 } }]);
    setTwoWay(w, '0', 0, false);
    room.exits[0]!.transition = 'fade_w';
    expect(reverseExit(w, '0', 0)).toEqual({ room: other, index: 0 });
    expect(room.exits).toEqual([]);
    expect(dest.exits).toEqual([{ x: 3, y: 4, dest: { room: '0', x: 3, y: 4 }, transition: 'fade_w' }]);
  });

  it('moves the way back with the exit and with its destination', () => {
    const { w, other, room, dest } = linked();
    expect(moveExit(w, '0', 0, 6, 7)).toBe(true);
    expect(room.exits[0]).toMatchObject({ x: 6, y: 7 });
    expect(dest.exits[0]!.dest).toEqual({ room: '0', x: 6, y: 7 });
    setExitDest(w, '0', 0, { room: other, x: 9, y: 9 });
    expect(dest.exits).toEqual([{ x: 9, y: 9, dest: { room: '0', x: 6, y: 7 } }]);
    const third = addRoom(w);
    setExitDest(w, '0', 0, { room: third, x: 1, y: 2 });
    expect(dest.exits).toEqual([]);
    expect(byId(w.rooms, third)!.exits).toEqual([{ x: 1, y: 2, dest: { room: '0', x: 6, y: 7 } }]);
    addEnding(w, '0', 0, 0);
    expect(moveExit(w, '0', 0, 0, 0)).toBe(false);
  });

  it('removes both ways', () => {
    const { w, room, dest } = linked();
    expect(removeExit(w, '0', 3, 4)).toBe(true);
    expect(room.exits).toEqual([]);
    expect(dest.exits).toEqual([]);
  });
});

describe('exit dialog', () => {
  it('adds narration, or a lock opened by a key, and takes it off again', () => {
    const w = world();
    addRoom(w);
    addExit(w, '0', 3, 4);
    const narration = setExitDialog(w, '0', 0, 'narration')!;
    expect(w.rooms[0]!.exits[0]!.dialog).toBe(narration);
    expect(dialogText(w, narration)).toBe('You walk through the doorway');
    expect(byId(w.dialogs, narration)!.name).toBe('exit narration');

    const lock = setExitDialog(w, '0', 0, 'lock')!;
    expect(w.dialogs.some((d) => d.name === 'exit narration')).toBe(false);
    const key = w.items.find((i) => i.name === 'key')!.id;
    expect(dialogText(w, lock)).toBe(
      `{\n  - {item "${key}"} >= 1 ?\n    {property locked false}\n    The key opens the door!\n  - else ?\n    {property locked true}\n    The door is locked...\n}`,
    );
    expect(serialize(w)).toMatch(new RegExp(`EXT 3,4 1 3,4 DLG ${lock}\n`));

    setExitDialog(w, '0', 0, null);
    expect(w.rooms[0]!.exits[0]!.dialog).toBeUndefined();
    expect(byId(w.dialogs, lock)).toBeUndefined();
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

  it('takes the way back too', () => {
    const w = world();
    const other = addRoom(w);
    addExit(w, '0', 1, 1);
    expect(eraseMarkerAt(w, '0', 1, 1)).toBe(true);
    expect(byId(w.rooms, other)!.exits).toEqual([]);
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

describe('starting inventory', () => {
  it('sets how many of an item the avatar starts with, and writes it on the avatar', () => {
    const w = world();
    expect(startingItem(w, '1')).toBe(0);
    setStartingItem(w, '1', 2);
    expect(startingItem(w, '1')).toBe(2);
    expect(serialize(w)).toMatch(/SPR A\n[\s\S]*?ITM 1 2\n/);
    setStartingItem(w, '1', 0);
    expect(byId(w.sprites, 'A')!.inventory).toEqual([]);
  });
});
