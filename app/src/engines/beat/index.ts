import { Music2 } from 'lucide-react';
import type { EngineModule } from '../types';
import { blankGame, parseGame, serializeGame, type Game } from './model';
import game from './tools/game';
import play from './tools/play';
import rules from './tools/rules';
import screens from './tools/screens';
import things from './tools/things';

/** Chili Beat: things bump, move and change on the beat. Played by the chili-beat wasm engine. */
export const beatEngine: EngineModule<Game> = {
  id: 'beat',
  title: 'Chili Beat',
  description: 'Things bump, move and change on the beat. Rules are cards.',
  icon: Music2,
  format: {
    extension: '.beat',
    detect: (text) => /^\s*\{[\s\S]*"format"\s*:\s*"chili-beat"/.test(text.slice(0, 200)),
    parse: parseGame,
    serialize: serializeGame,
  },
  newGame: blankGame,
  gameTitle: (g) => g.title,
  setTitle(g, title) {
    g.title = title;
  },
  check: () => [],
  editors: [{ id: 'beat', title: 'Chili Beat editor', tools: [screens, things, rules, play, game] }],
};
