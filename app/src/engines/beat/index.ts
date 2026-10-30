import { Music2 } from 'lucide-react';
import type { EngineModule } from '../types';
import { checkGame } from './check';
import beeHome from './fixtures/bee-home.beat?raw';
import cratePuzzle from './fixtures/crate-puzzle.beat?raw';
import gardenToy from './fixtures/garden-toy.beat?raw';
import { blankGame, parseGame, serializeGame, type Game } from './model';

/** A copy of an example game with a new title. */
function template(text: string) {
  return (title: string) => {
    const game = parseGame(text).doc;
    game.title = title;
    return serializeGame(game);
  };
}
import game from './tools/game';
import play from './tools/play';
import problems from './tools/problems';
import rules from './tools/rules';
import screens from './tools/screens';
import sounds from './tools/sounds';
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
  templates: [
    { title: 'Bee Home', make: template(beeHome) },
    { title: 'Crate Puzzle', make: template(cratePuzzle) },
    { title: 'Garden Toy', make: template(gardenToy) },
  ],
  gameTitle: (g) => g.title,
  setTitle(g, title) {
    g.title = title;
  },
  check: checkGame,
  editors: [{ id: 'beat', title: 'Chili Beat editor', tools: [screens, things, rules, sounds, play, problems, game] }],
};
