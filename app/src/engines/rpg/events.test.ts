import { describe, expect, it } from 'vitest';
import { actionType, conditionType, eventFrom, eventParts, knownFlags, knownVars, newAction, newCondition, setInline } from './events';
import { blankGame, parseGame, type Game } from './model';

const game = (): Game => {
  const g = parseGame(blankGame('Test')).doc;
  g.items = [{ id: 'key' }];
  g.dialogue = [{ id: 'hi', lines: [{ text: 'Hi', do: [{ set: 'met' }], if: [{ not: 'gone' }, { var: 'gold' }] }] }];
  g.quests = [{ id: 'find', stages: [{}] }];
  return g;
};

describe('Chili RPG events', () => {
  it('splits an event into conditions, actions and else, and back', () => {
    expect(eventParts(undefined)).toEqual({ if: [], do: [], else: [] });
    expect(eventParts([{ heal: 2 }])).toEqual({ if: [], do: [{ heal: 2 }], else: [] });
    expect(eventParts({ if: [{ flag: 'a' }], do: [{ heal: 2 }] })).toEqual({ if: [{ flag: 'a' }], do: [{ heal: 2 }], else: [] });
    expect(eventFrom({ if: [], do: [], else: [] })).toBeUndefined();
    expect(eventFrom({ if: [], do: [{ heal: 2 }], else: [] })).toEqual([{ heal: 2 }]);
    expect(eventFrom({ if: [{ flag: 'a' }], do: [], else: [{ say: 'hi' }] })).toEqual({ if: [{ flag: 'a' }], else: [{ say: 'hi' }] });
  });

  it('writes an event onto a dialogue line or trigger, leaving out what is empty', () => {
    const line: Record<string, unknown> = { text: 'Hi', do: [{ heal: 1 }] };
    setInline(line, { if: [{ flag: 'a' }], do: [], else: [] });
    expect(line).toEqual({ text: 'Hi', if: [{ flag: 'a' }] });
  });

  it('makes new actions and conditions that point at what the game has', () => {
    const g = game();
    expect(newAction('give', g)).toEqual({ give: 'key' });
    expect(newAction('warp', g)).toEqual({ warp: 'start', x: 7, y: 7 });
    expect(newAction('quest', g)).toEqual({ quest: 'find', stage: 1 });
    expect(newAction('end', g)).toEqual({ end: 'win' });
    expect(newCondition('has', g)).toEqual({ has: 'key' });
    expect(newCondition('quest', g)).toEqual({ quest: 'find', stage: 1 });
    expect(newCondition('stat', g)).toEqual({ stat: 'hp', op: '>=', value: 1 });
  });

  it('tells what kind of action or condition a row is', () => {
    expect(actionType({ add: 'gold', value: 1 })).toBe('add');
    expect(actionType({ stat: 'atk', value: 1 })).toBe('stat');
    expect(actionType({ quest: 'q', done: true })).toBe('quest');
    expect(conditionType({ var: 'gold' })).toBe('var');
    expect(conditionType({ quest: 'q', done: true })).toBe('quest');
  });

  it('knows the flags and variables the game names', () => {
    expect(knownFlags(game())).toEqual(['gone', 'met']);
    expect(knownVars(game())).toEqual(['gold']);
  });
});
