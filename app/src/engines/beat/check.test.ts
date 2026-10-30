import { describe, expect, it } from 'vitest';
import { checkGame } from './check';
import { blankGame, parseGame, type Game } from './model';

const fixtures = import.meta.glob('./fixtures/*.beat', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const blank = (): Game => parseGame(blankGame('Test')).doc;
const messages = (game: Game) => checkGame(game).map((p) => `${p.severity}: ${p.message}`);

describe('checking a Chili Beat game', () => {
  it('finds nothing wrong with Bee Home', () => {
    expect(checkGame(parseGame(fixtures['./fixtures/bee-home.beat']!).doc)).toEqual([]);
  });

  it('says when nothing on the start screen is you', () => {
    const game = blank();
    game.things[0]!.you = false;
    expect(messages(game)).toContain('error: Nothing on the start screen is "you", so nobody can play.');
  });

  it('points at rules that use a missing thing, counter, sound or screen', () => {
    const game = blank();
    game.rules.push({ when: { bump: ['you', 'z'] }, do: [{ count: 'gems', add: 1 }, { sound: 'ding' }, { go: 'cave' }] });
    expect(messages(game)).toEqual(
      expect.arrayContaining([
        'error: Rule 2 uses a thing that is gone (z).',
        'error: Rule 2 uses a counter that is gone (gems).',
        'error: Rule 2 uses a sound that is gone (ding).',
        'error: Rule 2 uses a screen that is gone (cave).',
      ]),
    );
  });

  it('warns about a rule with no actions', () => {
    const game = blank();
    game.rules.push({ when: { press: 'a' }, do: [] });
    expect(messages(game)).toContain('warning: Rule 2 does nothing.');
  });

  it('notes a game with no way to win or lose, which is fine for toys', () => {
    expect(messages(blank())).toContain('info: No rule wins or loses. That is fine for a toy.');
  });

  it('notes screens you cannot reach', () => {
    const game = blank();
    game.screens.push({ id: 'far', map: [5, 5], things: Array(16).fill('.'.repeat(16)) });
    game.screens.push({ id: 'next', map: [1, 0], things: Array(16).fill('.'.repeat(16)) });
    // "next" is beside the start screen, but the wall has no gap.
    expect(messages(game)).toContain('info: Screen "far" can\'t be reached.');
    expect(messages(game)).toContain('info: Screen "next" can\'t be reached.');
    game.screens[0]!.things[7] = '#...............';
    expect(messages(game)).not.toContain('info: Screen "next" can\'t be reached.');
    game.rules.push({ when: { press: 'a' }, do: [{ go: 'far' }] });
    expect(messages(game)).not.toContain('info: Screen "far" can\'t be reached.');
  });
});
