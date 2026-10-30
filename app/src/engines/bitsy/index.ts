import { Puzzle } from 'lucide-react';
import { createWorld, parse, serialize, validate, type World } from '../../bitsy';
import { bitsyTools } from '../../tools';
import type { EngineModule } from '../types';

/** Bitsy: rooms, sprites, dialog and tunes. Played by citsy. */
export const bitsyEngine: EngineModule<World> = {
  id: 'bitsy',
  title: 'Bitsy',
  description: 'Rooms, characters to talk to, and stories.',
  icon: Puzzle,
  format: {
    extension: '.bitsy',
    detect: (text) => /^# BITSY VERSION /m.test(text),
    parse(text) {
      const { world, issues } = parse(text);
      return { doc: world, issues };
    },
    serialize,
  },
  newGame: (title) => serialize(createWorld({ title })),
  gameTitle: (world) => world.title,
  setTitle(world, title) {
    world.title = title;
  },
  check: (world) => validate(world),
  editors: [{ id: 'bitsy', title: 'Bitsy creator', tools: bitsyTools }],
};
