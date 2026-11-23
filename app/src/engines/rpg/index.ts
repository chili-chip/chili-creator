import { Swords } from 'lucide-react';
import type { EngineModule } from '../types';
import { checkGame } from './check';
import pepperVillage from './fixtures/pepper-village.rpg?raw';
import { blankGame, parseGame, serializeGame, type Game } from './model';
import art from './tools/art';
import characters from './tools/characters';
import dialogue from './tools/dialogue';
import game from './tools/game';
import hero from './tools/hero';
import items from './tools/items';
import play from './tools/play';
import problems from './tools/problems';
import quests from './tools/quests';
import rooms from './tools/rooms';
import tiles from './tools/tiles';

/** A copy of an example game with a new title. */
function template(text: string) {
  return (title: string) => {
    const game = parseGame(text).doc;
    game.title = title;
    return serializeGame(game);
  };
}

/** Chili RPG: rooms to explore, people to talk to, fights and quests. Played by the game SDK's RPG engine. */
export const rpgEngine: EngineModule<Game> = {
  id: 'rpg',
  title: 'Chili RPG',
  description: 'Explore rooms, talk to people, fight and finish quests.',
  icon: Swords,
  format: {
    extension: '.rpg',
    detect: (text) => /^\s*\{[\s\S]*"format"\s*:\s*"chili-rpg"/.test(text.slice(0, 200)),
    parse: parseGame,
    serialize: serializeGame,
  },
  newGame: blankGame,
  templates: [{ title: 'Pepper Village', make: template(pepperVillage) }],
  gameTitle: (g) => g.title,
  setTitle(g, title) {
    g.title = title;
  },
  check: checkGame,
  editors: [{ id: 'rpg', title: 'Chili RPG editor', tools: [rooms, art, tiles, hero, characters, items, dialogue, quests, play, problems, game] }],
};
