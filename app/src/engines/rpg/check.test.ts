import { describe, expect, it } from 'vitest';
import { checkGame } from './check';
import { blankGame, parseGame, type Game } from './model';
import village from './fixtures/pepper-village.rpg?raw';

const blank = (): Game => parseGame(blankGame('Test')).doc;
const messages = (game: Game) => checkGame(game).map((p) => `${p.severity}: ${p.message}`);

describe('checking a Chili RPG game', () => {
  it('finds nothing wrong with Pepper Village', () => {
    expect(checkGame(parseGame(village).doc)).toEqual([]);
  });

  it('says when the start is not in a room, or is in a wall', () => {
    const game = blank();
    game.start = { room: 'nowhere', x: 1, y: 1 };
    expect(messages(game)).toContain('error: The start room "nowhere" is gone.');
    game.start = { room: 'start', x: 0, y: 0 };
    expect(messages(game)).toContain('error: The hero starts inside a solid tile.');
    game.start = { room: 'start', x: 20, y: 1 };
    expect(messages(game)).toContain('error: The hero starts outside the room.');
  });

  it('checks the map: same width rows, size, and tiles that exist', () => {
    const game = blank();
    game.rooms[0]!.ground[3] = '#....?.........#';
    game.rooms[0]!.ground[4] = '#...#';
    expect(messages(game)).toEqual(
      expect.arrayContaining(['error: Room "start" uses a tile that is gone (?).', 'error: Room "start" has rows of different widths.']),
    );
    game.rooms[0]!.ground = game.rooms[0]!.ground.slice(0, 8);
    expect(messages(game)).toContain('error: Room "start" must be 16 to 64 tiles tall.');
  });

  it('points at things in rooms that use something gone', () => {
    const game = blank();
    game.rooms[0]!.actors = [{ kind: 'slime', x: 2, y: 2 }];
    game.rooms[0]!.items = [{ item: 'potion', x: 3, y: 3 }];
    game.rooms[0]!.warps = [{ x: 4, y: 4, to: 'cave', tx: 1, ty: 1 }];
    expect(messages(game)).toEqual(
      expect.arrayContaining([
        'error: Room "start" uses a character that is gone (slime).',
        'error: Room "start" uses an item that is gone (potion).',
        'error: Room "start" uses a room that is gone (cave).',
      ]),
    );
  });

  it('points at events, dialogue and quests that use something gone', () => {
    const game = blank();
    game.kinds = [{ id: 'elder', sprite: 2, talk: 'hello', bump: [{ give: 'gem' }, { quest: 'find' }] }];
    game.dialogue = [{ id: 'chat', lines: [{ text: 'Hi', choices: [{ text: 'Go', goto: 'bye' }], if: [{ has: 'key' }] }] }];
    game.quests = [{ id: 'q', stages: [{ goal: { defeat: 'dragon' } }] }];
    expect(messages(game)).toEqual(
      expect.arrayContaining([
        'error: Character "elder" uses a dialogue that is gone (hello).',
        'error: Character "elder" uses an item that is gone (gem).',
        'error: Character "elder" uses a quest that is gone (find).',
        'error: Dialogue "chat" uses a line that is gone (bye).',
        'error: Dialogue "chat" uses an item that is gone (key).',
        'error: Quest "q" uses a character that is gone (dragon).',
      ]),
    );
  });

  it('says when hp or max_hp is missing', () => {
    const game = blank();
    game.stats = game.stats.filter((s) => s.id !== 'max_hp');
    expect(messages(game)).toContain('error: The hero needs the stats "hp" and "max_hp".');
  });

  it('warns about sprites with no picture', () => {
    const game = blank();
    game.player.sprite = 40;
    expect(messages(game)).toContain('warning: The hero uses picture 40, which is empty.');
  });

  it('notes rooms you cannot reach and a game with no ending', () => {
    const game = blank();
    game.rooms.push({ id: 'far', ground: blank().rooms[0]!.ground });
    expect(messages(game)).toContain('info: Room "far" can\'t be reached.');
    expect(messages(game)).toContain('info: Nothing ends the game with a win. That is fine while you build.');
    game.rooms[0]!.warps = [{ x: 4, y: 4, to: 'far', tx: 1, ty: 1 }];
    expect(messages(game)).not.toContain('info: Room "far" can\'t be reached.');
  });
});
