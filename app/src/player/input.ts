import { Button } from './loop';

const keys: Record<string, Button> = {
  arrowup: Button.Up,
  w: Button.Up,
  arrowdown: Button.Down,
  s: Button.Down,
  arrowleft: Button.Left,
  a: Button.Left,
  arrowright: Button.Right,
  d: Button.Right,
  ' ': Button.Ok,
  enter: Button.Ok,
  z: Button.Ok,
  x: Button.Ok,
  escape: Button.Menu,
};

/** The citsy button for a KeyboardEvent.key, as the classic player maps them. */
export function buttonForKey(key: string): Button | undefined {
  return keys[key.toLowerCase()];
}
