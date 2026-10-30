import { describe, expect, it } from 'vitest';
import { blankGame, parseGame } from './model';
import {
  addCounter,
  addRule,
  addScreen,
  addThing,
  deleteThing,
  moveRule,
  nextKey,
  paintCell,
  renameThingKey,
  setPixel,
  screenAt,
} from './edit';

const blank = () => parseGame(blankGame('Test')).doc;

describe('editing a Chili Beat game', () => {
  it('adds things with the next free key and a blank picture', () => {
    const game = blank();
    expect(nextKey(game)).toBe('a');
    const thing = addThing(game);
    expect(thing).toMatchObject({ key: 'a', name: 'Thing 1' });
    expect(thing.frames).toEqual([Array(8).fill('00000000')]);
    expect(addThing(game).key).toBe('b');
  });

  it('draws one pixel of a frame', () => {
    const game = blank();
    setPixel(game, '@', 0, 3, 2, 1);
    expect(game.things[0]!.frames[0]![2]![3]).toBe('1');
  });

  it('paints and erases cells on a layer', () => {
    const game = blank();
    paintCell(game, 'start', 'things', 2, 3, '#');
    expect(game.screens[0]!.things[3]![2]).toBe('#');
    paintCell(game, 'start', 'ground', 2, 3, '#');
    expect(game.screens[0]!.ground).toHaveLength(16);
    expect(game.screens[0]!.ground![3]![2]).toBe('#');
    paintCell(game, 'start', 'things', 2, 3, '.');
    expect(game.screens[0]!.things[3]![2]).toBe('.');
  });

  it('adds a screen at a free map place', () => {
    const game = blank();
    const screen = addScreen(game, 1, 0);
    expect(screen).toMatchObject({ id: 'screen-1', map: [1, 0] });
    expect(screen.things).toHaveLength(16);
    expect(screenAt(game, 1, 0)).toBe(screen);
    expect(() => addScreen(game, 1, 0)).toThrow();
  });

  it('deletes a thing everywhere it is used', () => {
    const game = blank();
    deleteThing(game, '#');
    expect(game.things.map((t) => t.key)).toEqual(['@']);
    expect(game.screens[0]!.things.join('')).not.toContain('#');
  });

  it('changes a thing key everywhere', () => {
    const game = blank();
    game.rules.push({ when: { bump: ['@', '#'] }, do: [{ become: '#' }] });
    renameThingKey(game, '#', 'w');
    expect(game.screens[0]!.things[0]).toBe('wwwwwwwwwwwwwwww');
    expect(game.rules[1]).toEqual({ when: { bump: ['@', 'w'] }, do: [{ become: 'w' }] });
  });

  it('adds and orders rules', () => {
    const game = blank();
    addRule(game);
    expect(game.rules).toHaveLength(2);
    expect(game.rules[1]).toEqual({ when: { press: 'a' }, do: [{ say: 'Hello!' }] });
    moveRule(game, 1, -1);
    expect(game.rules[0]!.when).toEqual({ press: 'a' });
  });

  it('adds up to 4 counters', () => {
    const game = blank();
    for (let i = 0; i < 4; i++) addCounter(game);
    expect(game.counters!.map((c) => c.id)).toEqual(['counter-1', 'counter-2', 'counter-3', 'counter-4']);
    expect(() => addCounter(game)).toThrow();
  });
});
