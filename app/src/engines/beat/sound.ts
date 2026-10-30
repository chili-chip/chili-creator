import type { Blip, Game, Tune } from './model';
import { LIMITS } from './model';

function freeId(taken: string[], base: string): string {
  for (let n = 1; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
}

export function addBlip(game: Game): Blip {
  game.blips ??= [];
  if (game.blips.length >= LIMITS.blips) throw new Error('A game can have 16 sounds.');
  const blip: Blip = { id: freeId(game.blips.map((b) => b.id), 'blip'), preset: 'blip', pitch: 4, length: 3, slide: 0 };
  game.blips.push(blip);
  return blip;
}

export function addTune(game: Game): Tune {
  game.tunes ??= [];
  if (game.tunes.length >= LIMITS.tunes) throw new Error('A game can have 8 tunes.');
  const tune: Tune = { id: freeId(game.tunes.map((t) => t.id), 'tune'), scale: 'major', lead: Array(16).fill(0), beat: Array(16).fill(0) };
  game.tunes.push(tune);
  return tune;
}

/** Sets one step of a voice. The same value again makes it a rest. */
export function setStep(game: Game, tuneId: string, voice: 'lead' | 'beat', step: number, value: number) {
  const steps = game.tunes!.find((t) => t.id === tuneId)![voice];
  steps[step] = steps[step] === value ? 0 : value;
}

export function renameBlip(game: Game, from: string, to: string) {
  if (game.blips?.some((b) => b.id === to)) throw new Error(`A sound is already called ${to}.`);
  game.blips!.find((b) => b.id === from)!.id = to;
  for (const rule of game.rules) for (const action of rule.do) if ('sound' in action && action.sound === from) action.sound = to;
}

export function renameTune(game: Game, from: string, to: string) {
  if (game.tunes?.some((t) => t.id === to)) throw new Error(`A tune is already called ${to}.`);
  game.tunes!.find((t) => t.id === from)!.id = to;
  for (const screen of game.screens) if (screen.tune === from) screen.tune = to;
}

/** A tiny game that plays one blip at once, or one tune on its screen, to preview it with the real engine. */
export function previewGame(game: Game, { blip, tune }: { blip?: string; tune?: string }): string {
  return JSON.stringify({
    format: 'chili-beat',
    version: 1,
    title: 'Preview',
    palette: game.palette,
    tempo: game.tempo,
    time: 'beat',
    start: 'preview',
    things: [{ key: '@', name: 'You', you: true, frames: [Array(8).fill('00000000')] }],
    screens: [{ id: 'preview', map: [0, 0], ...(tune ? { tune } : {}), things: ['@'.padEnd(16, '.'), ...Array(15).fill('.'.repeat(16))] }],
    rules: blip ? [{ when: { start: true }, do: [{ sound: blip }] }] : [],
    blips: game.blips ?? [],
    tunes: game.tunes ?? [],
  });
}
