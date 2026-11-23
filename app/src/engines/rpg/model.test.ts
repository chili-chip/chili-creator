import { describe, expect, it } from 'vitest';
import { blankGame, parseGame, serializeGame, SWEETIE_16 } from './model';

const fixtures = import.meta.glob('./fixtures/*.rpg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the .rpg model', () => {
  it.each(Object.keys(fixtures))('round-trips %s byte for byte', (path) => {
    const text = fixtures[path]!;
    const { doc, issues } = parseGame(text);
    expect(issues).toEqual([]);
    expect(serializeGame(doc)).toBe(text);
  });

  it('writes each picture on one line', () => {
    const text = fixtures['./fixtures/blank.rpg']!;
    expect(text).toContain('\n      ["dddddddd", "ddddddd.", ".......e", "eeeeeeee", "eeeeeeee", "eeeeeeee", "eeeeeeee", "eeeeeee."],\n');
  });

  it('reads the parts of a game', () => {
    const { doc } = parseGame(fixtures['./fixtures/pepper-village.rpg']!);
    expect(doc.title).toBe('Pepper Village');
    expect(doc.rooms.map((r) => r.id)).toEqual(['village', 'cave']);
    expect(doc.art!.pictures).toHaveLength(140);
    expect(doc.kinds![0]).toMatchObject({ id: 'elder', talk: 'elder' });
  });

  it('says what is wrong with text that is not a Chili RPG game', () => {
    expect(parseGame('not json').issues[0]!.message).toMatch(/not a Chili RPG game/);
    expect(parseGame('{"format":"chili-rpg","version":2}').issues[0]!.message).toMatch(/newer/);
  });

  it('makes a blank game with a title, one walled room and the hero', () => {
    const game = parseGame(blankGame('My game')).doc;
    expect(game.title).toBe('My game');
    expect(game.rooms).toHaveLength(1);
    expect(game.rooms[0]!.ground).toHaveLength(16);
    expect(game.start).toEqual({ room: 'start', x: 7, y: 7 });
  });

  it('knows Sweetie 16', () => {
    expect(SWEETIE_16).toHaveLength(16);
    expect(SWEETIE_16[12]).toBe('#f4f4f4');
  });
});
