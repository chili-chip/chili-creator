// Ready-made rule cards for common ideas (chili-beat docs/rules.md, Recipes).
import { addCounter, addRule, addThing } from './edit';
import type { Game, Picture, Rule } from './model';

const PICTURES: Record<string, Picture> = {
  Coin: ['00000000', '00333300', '03322330', '03233230', '03233230', '03322330', '00333300', '00000000'],
  Crate: ['22222222', '21111112', '21211212', '21122112', '21122112', '21211212', '21111112', '22222222'],
  Key: ['00000000', '03330000', '03030000', '03333333', '00000303', '00000303', '00000000', '00000000'],
  Door: ['02222220', '21111112', '21111112', '21111112', '21111132', '21111112', '21111112', '21111112'],
  Wasp: ['33000033', '03300330', '00222200', '22323232', '02323230', '00222200', '00200200', '00000000'],
  Cat: ['00000000', '20000020', '22000220', '22222220', '23222320', '22232220', '02222200', '00000000'],
  Owl: ['02000020', '02222220', '23322332', '23322332', '02222220', '02211220', '02211220', '00200200'],
  Flag: ['03000000', '03222200', '03222220', '03222200', '03000000', '03000000', '03000000', '33300000'],
  Fire: ['00030000', '00033000', '00323000', '03223300', '03222300', '32212230', '32211230', '03322300'],
};

/** The key of the thing with this name, drawn and added if it is not there yet. */
function thing(game: Game, name: string): string {
  const found = game.things.find((t) => t.name === name);
  if (found) return found.key;
  const added = addThing(game);
  added.name = name;
  added.frames = [[...PICTURES[name]!]];
  return added.key;
}

/** The id of the counter with this name, added if it is not there yet. */
function counter(game: Game, name: string, icon: string, start = 0): string {
  const found = (game.counters ?? []).find((c) => c.name === name);
  if (found) return found.id;
  const added = addCounter(game);
  Object.assign(added, { id: name.toLowerCase(), name, icon, start });
  return added.id;
}

export interface Recipe {
  id: string;
  title: string;
  apply(game: Game): void;
}

const recipe = (id: string, title: string, rules: (game: Game) => Rule[]): Recipe => ({
  id,
  title,
  apply: (game) => rules(game).forEach((rule) => addRule(game, rule)),
});

export const RECIPES: Recipe[] = [
  recipe('pick-up', 'Pick-up: bump a coin to collect it', (g) => {
    const coin = thing(g, 'Coin');
    const coins = counter(g, 'Coins', coin);
    return [{ when: { bump: ['you', coin] }, do: [{ vanish: true, who: 'bumped' }, { count: coins, add: 1 }] }];
  }),
  recipe('push', 'Push: crates move when you bump them', (g) => {
    const crate = thing(g, 'Crate');
    return [{ when: { bump: ['you', crate] }, do: [{ move: 'same', who: 'bumped' }] }];
  }),
  recipe('door-and-key', 'Door and key: a key opens one door', (g) => {
    const key = thing(g, 'Key');
    const door = thing(g, 'Door');
    const keys = counter(g, 'Keys', key);
    return [
      { when: { bump: ['you', key] }, do: [{ vanish: true, who: 'bumped' }, { count: keys, add: 1 }] },
      { when: { bump: ['you', door] }, if: [{ counter: keys, atLeast: 1 }], do: [{ vanish: true, who: 'bumped' }, { count: keys, add: -1 }] },
    ];
  }),
  recipe('chaser', 'Chaser: a wasp follows you', (g) => {
    const wasp = thing(g, 'Wasp');
    return [
      { when: { every: 2, thing: wasp }, do: [{ move: 'toward' }] },
      { when: { bump: [wasp, 'you'] }, do: [{ shake: true }, { lose: 'Caught!' }] },
    ];
  }),
  recipe('wanderer', 'Wanderer: a cat walks around', (g) => {
    const cat = thing(g, 'Cat');
    return [{ when: { every: 1, thing: cat }, if: [{ chance: 3 }], do: [{ move: 'random' }] }];
  }),
  recipe('talker', 'Talker: an owl says something', (g) => {
    const owl = thing(g, 'Owl');
    return [{ when: { bump: ['you', owl] }, do: [{ say: 'Hoo!' }] }];
  }),
  recipe('goal', 'Goal: reach the flag to win', (g) => {
    const flag = thing(g, 'Flag');
    return [{ when: { bump: ['you', flag] }, do: [{ win: 'Well done!' }] }];
  }),
  recipe('spreader', 'Spreader: fire grows', (g) => {
    const fire = thing(g, 'Fire');
    return [{ when: { every: 1, thing: fire }, if: [{ chance: 4 }], do: [{ make: fire, to: 'random' }] }];
  }),
  recipe('timer', 'Timer: lose when time runs out', (g) => {
    const time = counter(g, 'Time', g.things.find((t) => t.you)?.key ?? g.things[0]!.key, 30);
    return [
      { when: { every: 4, thing: 'you' }, do: [{ count: time, add: -1 }] },
      { when: { counter: time, reaches: 0 }, do: [{ lose: 'Out of time.' }] },
    ];
  }),
];
