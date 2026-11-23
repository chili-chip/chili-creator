import { describe, expect, it } from 'vitest';
import {
  addDialogue,
  addItem,
  addKind,
  addQuest,
  deleteDialogue,
  deleteItem,
  deleteKind,
  deleteQuest,
  renameId,
  addPicture,
  addRoom,
  addTile,
  deleteRoom,
  deleteTile,
  freshId,
  objectsAt,
  paintCell,
  parsePatrol,
  place,
  removeAt,
  renameRoom,
  resizeRoom,
  setPixel,
  setRule,
  whole,
} from './edit';
import { blankGame, parseGame, type Game } from './model';

const blank = (): Game => parseGame(blankGame('Test')).doc;

describe('editing a Chili RPG game', () => {
  it('keeps numbers whole and in range', () => {
    expect(whole('7.6', 0, 10)).toBe(8);
    expect(whole('99', 0, 10)).toBe(10);
    expect(whole('x', 1, 10)).toBe(1);
  });

  it('leaves default rules out of the file', () => {
    const game = blank();
    setRule(game, 'bag', 8, 16);
    expect(game.rules).toEqual({ bag: 8 });
    setRule(game, 'bag', 16, 16);
    expect(game.rules).toBeUndefined();
  });

  it('finds a fresh id', () => {
    expect(freshId('room', ['room-1', 'start'])).toBe('room-2');
  });

  it('draws on a picture and adds pictures', () => {
    const game = blank();
    setPixel(game, 0, 2, 1, 'c');
    expect(game.art!.pictures[0]![1]).toBe('..c.....');
    expect(addPicture(game)).toBe(3);
    expect(game.art!.pictures[3]).toEqual(Array(8).fill('........'));
    expect(addPicture(game, 1)).toBe(4);
    expect(game.art!.pictures[4]).toEqual(game.art!.pictures[1]);
  });

  it('gives a game without art its own pictures when you draw', () => {
    const game = blank();
    delete game.art;
    expect(addPicture(game)).toBe(0);
    expect(game.art).toEqual({ palette: 'sweetie16', pictures: [Array(8).fill('........')] });
  });

  it('adds a tile with a free key, and deletes one by painting the first tile over it', () => {
    const game = blank();
    const tile = addTile(game, 2);
    expect(tile).toEqual({ key: 'a', sprite: 2 });
    paintCell(game, 'start', 'ground', 3, 3, 'a');
    paintCell(game, 'start', 'top', 4, 4, 'a');
    expect(game.rooms[0]!.ground[3]).toBe('#..a...........#');
    expect(game.rooms[0]!.top![4]).toBe('    a           ');
    deleteTile(game, 'a');
    expect(game.tiles.map((t) => t.key)).toEqual(['.', '#']);
    expect(game.rooms[0]!.ground[3]).toBe('#..............#');
    expect(game.rooms[0]!.top).toBeUndefined();
  });

  it('drops the top layer when it is all empty again', () => {
    const game = blank();
    paintCell(game, 'start', 'top', 4, 4, '#');
    paintCell(game, 'start', 'top', 4, 4, ' ');
    expect(game.rooms[0]!.top).toBeUndefined();
  });

  it('places people, items, warps, triggers and the start, one per cell', () => {
    const game = blank();
    game.kinds = [{ id: 'slime', sprite: 2 }];
    game.items = [{ id: 'potion', icon: 2 }];
    place(game, 'start', { kind: 'slime' }, 2, 2);
    place(game, 'start', { item: 'potion' }, 2, 2);
    expect(game.rooms[0]!.actors).toBeUndefined();
    expect(game.rooms[0]!.items).toEqual([{ item: 'potion', x: 2, y: 2 }]);
    place(game, 'start', { warp: true }, 3, 3);
    expect(game.rooms[0]!.warps).toEqual([{ x: 3, y: 3, to: 'start', tx: 7, ty: 7 }]);
    place(game, 'start', { trigger: true }, 4, 4);
    expect(game.rooms[0]!.triggers).toEqual([{ x: 4, y: 4, do: [] }]);
    place(game, 'start', { start: true }, 5, 5);
    expect(game.start).toEqual({ room: 'start', x: 5, y: 5 });
    expect(objectsAt(game.rooms[0]!, 2, 2)).toEqual([{ type: 'item', index: 0 }]);
    removeAt(game, 'start', 2, 2);
    expect(game.rooms[0]!.items).toBeUndefined();
  });

  it('adds and deletes rooms, but never the start room', () => {
    const game = blank();
    const room = addRoom(game);
    expect(room.id).toBe('room-1');
    expect(room.ground).toEqual(Array(16).fill('.'.repeat(16)));
    game.rooms[0]!.warps = [{ x: 1, y: 1, to: 'room-1', tx: 2, ty: 2 }];
    deleteRoom(game, 'room-1');
    expect(game.rooms.map((r) => r.id)).toEqual(['start']);
    expect(game.rooms[0]!.warps).toBeUndefined();
    expect(() => deleteRoom(game, 'start')).toThrow('The game starts in this room');
  });

  it('resizes a room and keeps what is in it inside', () => {
    const game = blank();
    game.kinds = [{ id: 'slime', sprite: 2 }];
    place(game, 'start', { kind: 'slime' }, 15, 15);
    place(game, 'start', { warp: true }, 2, 2);
    game.rooms[0]!.warps![0]!.tx = 30;
    game.start = { room: 'start', x: 20, y: 3 };
    resizeRoom(game, 'start', 24, 18);
    const room = game.rooms[0]!;
    expect(room.ground).toHaveLength(18);
    expect(room.ground[0]).toBe('################........');
    expect(room.ground[17]).toBe('.'.repeat(24));
    resizeRoom(game, 'start', 16, 16);
    expect(room.ground[0]).toBe('################');
    expect(room.actors).toEqual([{ kind: 'slime', x: 15, y: 15 }]);
    resizeRoom(game, 'start', 16, 16);
    game.start = { room: 'start', x: 20, y: 3 };
    resizeRoom(game, 'start', 16, 16);
    expect(game.start).toEqual({ room: 'start', x: 15, y: 3 });
    expect(room.warps![0]).toMatchObject({ tx: 15 });
    expect(() => resizeRoom(game, 'start', 10, 16)).toThrow('16 to 64');
  });

  it('drops what falls outside when a room shrinks', () => {
    const game = blank();
    resizeRoom(game, 'start', 20, 20);
    game.kinds = [{ id: 'slime', sprite: 2 }];
    place(game, 'start', { kind: 'slime' }, 18, 18);
    resizeRoom(game, 'start', 16, 16);
    expect(game.rooms[0]!.actors).toBeUndefined();
  });

  it('renames a room and everything that names it', () => {
    const game = blank();
    addRoom(game);
    game.rooms[1]!.warps = [{ x: 1, y: 1, to: 'start', tx: 2, ty: 2 }];
    game.kinds = [{ id: 'door', bump: [{ warp: 'start', x: 1, y: 1 }] }];
    game.quests = [{ id: 'q', stages: [{ goal: { reach: 'start', x: 1, y: 1 } }] }];
    renameRoom(game, 'start', 'home');
    expect(game.start.room).toBe('home');
    expect(game.rooms[1]!.warps![0]!.to).toBe('home');
    expect(game.kinds[0]!.bump).toEqual([{ warp: 'home', x: 1, y: 1 }]);
    expect(game.quests[0]!.stages[0]!.goal!.reach).toBe('home');
    expect(() => renameRoom(game, 'home', 'room-1')).toThrow('already');
    expect(() => renameRoom(game, 'home', 'Big Room')).toThrow('lower case');
  });

  it('adds and deletes characters; deleting one takes its people out of rooms', () => {
    const game = blank();
    const kind = addKind(game);
    expect(kind).toEqual({ id: 'character-1', name: 'Character 1', sprite: 2, friendly: true });
    place(game, 'start', { kind: kind.id }, 2, 2);
    deleteKind(game, kind.id);
    expect(game.kinds).toBeUndefined();
    expect(game.rooms[0]!.actors).toBeUndefined();
  });

  it('adds and deletes items; deleting one takes it out of rooms and drops', () => {
    const game = blank();
    const item = addItem(game);
    expect(item).toEqual({ id: 'item-1', name: 'Item 1', icon: 2 });
    place(game, 'start', { item: item.id }, 2, 2);
    game.kinds = [{ id: 'slime', drops: [{ item: 'item-1' }] }];
    deleteItem(game, 'item-1');
    expect(game.items).toBeUndefined();
    expect(game.rooms[0]!.items).toBeUndefined();
    expect(game.kinds[0]!.drops).toBeUndefined();
  });

  it('adds dialogue and quests with one line and one stage', () => {
    const game = blank();
    expect(addDialogue(game)).toEqual({ id: 'talk-1', lines: [{ text: 'Hello!' }] });
    expect(addQuest(game)).toEqual({ id: 'quest-1', title: 'Quest 1', stages: [{ log: 'What to do.' }] });
    deleteDialogue(game, 'talk-1');
    deleteQuest(game, 'quest-1');
    expect(game.dialogue).toBeUndefined();
    expect(game.quests).toBeUndefined();
  });

  it('renames characters, items, dialogue and quests everywhere they are named', () => {
    const game = blank();
    game.kinds = [{ id: 'elder', talk: 'hi', drops: [{ item: 'gem' }] }];
    game.items = [{ id: 'gem', use: { if: [{ has: 'gem' }, { quest: 'q', stage: 1 }], do: [{ say: 'hi' }, { give: 'gem' }] } }];
    game.dialogue = [{ id: 'hi', who: 'elder', lines: [{ text: 'Hi' }] }];
    game.quests = [{ id: 'q', stages: [{ goal: { talk: 'elder' } }, { goal: { collect: 'gem' } }] }];
    game.rooms[0]!.actors = [{ kind: 'elder', x: 1, y: 1, talk: 'hi' }];
    game.rooms[0]!.items = [{ item: 'gem', x: 2, y: 2 }];
    renameId(game, 'kind', 'elder', 'ana');
    renameId(game, 'item', 'gem', 'ruby');
    renameId(game, 'dialogue', 'hi', 'hello');
    renameId(game, 'quest', 'q', 'main');
    expect(game.kinds[0]).toEqual({ id: 'ana', talk: 'hello', drops: [{ item: 'ruby' }] });
    expect(game.items[0]).toEqual({ id: 'ruby', use: { if: [{ has: 'ruby' }, { quest: 'main', stage: 1 }], do: [{ say: 'hello' }, { give: 'ruby' }] } });
    expect(game.dialogue[0]).toMatchObject({ id: 'hello', who: 'ana' });
    expect(game.quests[0]).toEqual({ id: 'main', stages: [{ goal: { talk: 'ana' } }, { goal: { collect: 'ruby' } }] });
    expect(game.rooms[0]!.actors).toEqual([{ kind: 'ana', x: 1, y: 1, talk: 'hello' }]);
    expect(game.rooms[0]!.items).toEqual([{ item: 'ruby', x: 2, y: 2 }]);
    expect(() => renameId(game, 'item', 'ruby', 'Ruby!')).toThrow('lower case');
  });

  it('reads patrol points from text', () => {
    expect(parsePatrol('6,10 16, 10;99,1')).toEqual([[6, 10], [16, 10], [63, 1]]);
    expect(parsePatrol('')).toEqual([]);
  });
});
