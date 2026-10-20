import { describe, expect, it } from 'vitest';
import { Button } from './loop';
import { buttonForKey } from './input';

describe('buttonForKey', () => {
  it.each([
    ['ArrowUp', Button.Up],
    ['w', Button.Up],
    ['W', Button.Up],
    ['ArrowDown', Button.Down],
    ['s', Button.Down],
    ['ArrowLeft', Button.Left],
    ['a', Button.Left],
    ['ArrowRight', Button.Right],
    ['d', Button.Right],
    [' ', Button.Ok],
    ['Enter', Button.Ok],
    ['z', Button.Ok],
    ['x', Button.Ok],
    ['Escape', Button.Menu],
  ])('maps %j', (key, button) => {
    expect(buttonForKey(key)).toBe(button);
  });

  it('ignores other keys', () => {
    expect(buttonForKey('q')).toBeUndefined();
    expect(buttonForKey('Tab')).toBeUndefined();
  });
});
