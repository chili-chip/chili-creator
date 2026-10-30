import { describe, expect, it } from 'vitest';
import { blankGame, parseGame, serializeGame, SWEETIE_16 } from './model';

const fixtures = import.meta.glob('./fixtures/*.beat', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the .beat model', () => {
  it.each(Object.keys(fixtures))('round-trips %s byte for byte', (path) => {
    const text = fixtures[path]!;
    const { doc, issues } = parseGame(text);
    expect(issues).toEqual([]);
    expect(serializeGame(doc)).toBe(text);
  });

  it('reads the parts of a game', () => {
    const { doc } = parseGame(fixtures['./fixtures/bee-home.beat']!);
    expect(doc.title).toBe('Bee Home');
    expect(doc.things.map((t) => t.key)).toEqual(['b', 'f', 'u', 'h', 'w', '#', ',']);
    expect(doc.screens[0]!.things[6]![3]).toBe('b');
    expect(doc.rules[1]!.when).toEqual({ bump: ['b', 'f'] });
  });

  it('says what is wrong with text that is not a Chili Beat game', () => {
    expect(parseGame('not json').issues[0]!.message).toMatch(/not a Chili Beat game/);
    expect(parseGame('{"format":"chili-beat","version":2}').issues[0]!.message).toMatch(/newer/);
  });

  it('makes a blank game with a title, one screen and the arrow rule', () => {
    const game = parseGame(blankGame('My game')).doc;
    expect(game.title).toBe('My game');
    expect(game.screens).toHaveLength(1);
    expect(game.rules).toEqual([{ when: { press: 'arrow' }, do: [{ move: 'same' }] }]);
  });

  it('knows Sweetie 16', () => {
    expect(SWEETIE_16).toHaveLength(16);
    expect(SWEETIE_16[0]).toBe('#1a1c2c');
  });
});
