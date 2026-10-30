import { describe, expect, it } from 'vitest';
import { checkGame } from './check';
import { blankGame, parseGame } from './model';
import { RECIPES } from './recipes';

const blank = () => parseGame(blankGame('Test')).doc;

describe('rule recipes', () => {
  it('offers the 9 recipes from the plan', () => {
    expect(RECIPES.map((r) => r.id)).toEqual(['pick-up', 'push', 'door-and-key', 'chaser', 'wanderer', 'talker', 'goal', 'spreader', 'timer']);
  });

  it('pick-up adds a Coin, a Coins counter and the card', () => {
    const game = blank();
    RECIPES.find((r) => r.id === 'pick-up')!.apply(game);
    const coin = game.things.find((t) => t.name === 'Coin')!;
    expect(game.counters).toEqual([{ id: 'coins', name: 'Coins', icon: coin.key, start: 0 }]);
    expect(game.rules.at(-1)).toEqual({
      when: { bump: ['you', coin.key] },
      do: [{ vanish: true, who: 'bumped' }, { count: 'coins', add: 1 }],
    });
  });

  it('reuses things and counters that are already there', () => {
    const game = blank();
    const pickUp = RECIPES.find((r) => r.id === 'pick-up')!;
    pickUp.apply(game);
    pickUp.apply(game);
    expect(game.things.filter((t) => t.name === 'Coin')).toHaveLength(1);
    expect(game.counters).toHaveLength(1);
  });

  it.each(RECIPES.map((r) => r.id))('%s leaves no errors behind', (id) => {
    const game = blank();
    RECIPES.find((r) => r.id === id)!.apply(game);
    expect(checkGame(game).filter((p) => p.severity === 'error')).toEqual([]);
  });
});
