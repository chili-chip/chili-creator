import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { placeOnScreen } from '../../../test/canvas';
import { renderTool } from '../../../test/creator';
import { blankGame, parseGame, type Game } from '../model';
import art from './art';
import characters from './characters';
import dialogue from './dialogue';
import game from './game';
import hero from './hero';
import items from './items';
import play from './play';
import problems from './problems';
import quests from './quests';
import rooms from './rooms';
import tiles from './tiles';

const engine = vi.hoisted(() => ({
  onStep: null as ((debug: unknown) => void) | null,
}));

vi.mock('../player', () => ({
  RPG_BUTTONS: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, x: 64, y: 128 },
  loadEngine: vi.fn(async () => ({
    load: (text: string) => (text.includes('"kind": "nobody"') ? 'rooms[0].actors[0].kind: no kind "nobody"' : null),
    start: vi.fn(),
    stop: vi.fn(),
    press: vi.fn(),
    enableSound: vi.fn(),
    muted: false,
    set onStep(f: ((debug: unknown) => void) | null) {
      engine.onStep = f;
    },
    get onStep() {
      return engine.onStep;
    },
  })),
}));

const data = blankGame('Test');

/** The blank game with one item, a gem. */
function withItem() {
  const g = parseGame(data).doc;
  g.items = [{ id: 'gem', name: 'Gem', icon: 1 }];
  return JSON.stringify(g);
}

async function open(Tool: { component: React.ComponentType }, text = data) {
  const view = await renderTool(Tool.component, { data: text });
  const doc = () => {
    const state = view.creator.projects.getState().open;
    if (state.status !== 'ready') throw new Error('not open');
    return state.doc as Game;
  };
  return { ...view, doc };
}

/** Clicks cell (x, y) of a canvas shown `size` pixels wide with `cells` cells. */
function click(name: RegExp, x: number, y: number, cells: number, size = 160) {
  const surface = screen.getByRole('application', { name });
  placeOnScreen(surface, size, size);
  const cell = size / cells;
  fireEvent.pointerDown(surface, { clientX: x * cell + 1, clientY: y * cell + 1, button: 0, pointerId: 1 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
}

describe('Chili RPG tools', () => {
  it('Art: draws a pixel, clears one, and adds a picture', async () => {
    const user = userEvent.setup();
    const { doc } = await open(art);
    await user.click(screen.getByRole('button', { name: 'Picture 1' }));
    await user.click(screen.getByRole('radio', { name: 'Sweetie 12 #f4f4f4' }));
    click(/^Drawing of picture 1/, 2, 1, 8);
    expect(doc().art!.pictures[1]![1]).toBe('ddcdddd.');
    await user.click(screen.getByRole('radio', { name: 'Clear' }));
    click(/^Drawing of picture 1/, 0, 0, 8);
    expect(doc().art!.pictures[1]![0]![0]).toBe('.');
    await user.click(screen.getByRole('button', { name: 'Add picture' }));
    expect(doc().art!.pictures).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Picture 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Tiles: adds a tile, picks its picture and makes it water', async () => {
    const user = userEvent.setup();
    const { doc } = await open(tiles);
    await user.click(screen.getByRole('button', { name: 'Add tile' }));
    expect(doc().tiles).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Use picture 2' }));
    await user.click(screen.getByRole('checkbox', { name: 'Water' }));
    expect(doc().tiles[2]).toEqual({ key: 'a', sprite: 2, water: true });
    await user.click(screen.getByRole('button', { name: 'Add frame' }));
    expect(doc().tiles[2]!.sprite).toEqual([2, 2]);
  });

  it('Rooms: paints tiles, places a warp, and adds a room', async () => {
    const user = userEvent.setup();
    const { doc } = await open(rooms);
    await user.click(screen.getByRole('radio', { name: 'Tile #' }));
    click(/^Room start/, 5, 5, 16);
    expect(doc().rooms[0]!.ground[5]![5]).toBe('#');
    await user.click(screen.getByRole('radio', { name: 'Top' }));
    click(/^Room start/, 6, 6, 16);
    expect(doc().rooms[0]!.top![6]![6]).toBe('#');
    await user.click(screen.getByRole('radio', { name: 'Place' }));
    await user.click(screen.getByRole('radio', { name: 'Warp' }));
    click(/^Room start/, 3, 3, 16);
    expect(doc().rooms[0]!.warps).toEqual([{ x: 3, y: 3, to: 'start', tx: 7, ty: 7 }]);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Warp to x' }), { target: { value: '2' } });
    expect(doc().rooms[0]!.warps![0]!.tx).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Add room' }));
    expect(doc().rooms.map((r) => r.id)).toEqual(['start', 'room-1']);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: 'Resize' }));
    expect(doc().rooms[1]!.ground[0]).toHaveLength(20);
  });

  it('Game: changes the author, background, start and rules', async () => {
    const user = userEvent.setup();
    const { doc } = await open(game);
    await user.type(screen.getByRole('textbox', { name: 'Author' }), 'Ana');
    expect(doc().author).toBe('Ana');
    await user.click(screen.getByRole('button', { name: 'Background Sweetie 8 #29366f' }));
    expect(doc().background).toBe('#29366f');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Start x' }), { target: { value: '3' } });
    expect(doc().start).toEqual({ room: 'start', x: 3, y: 7 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bag size' }), { target: { value: '8' } });
    expect(doc().rules).toEqual({ bag: 8 });
    await user.click(screen.getByRole('checkbox', { name: 'Diagonal steps' }));
    expect(doc().rules).toEqual({ bag: 8, diagonal: true });
  });

  it('Hero: sets the look, the stats, the XP for each level and what happens on death', async () => {
    const user = userEvent.setup();
    const { doc } = await open(hero);
    await user.click(screen.getByRole('button', { name: 'Use picture 1' }));
    expect(doc().player).toEqual({ sprite: 1 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'ATK at the start' }), { target: { value: '4' } });
    expect(doc().stats.find((s) => s.id === 'atk')!.start).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Add level' }));
    expect(doc().levels).toEqual({ xp: [10] });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'XP for level 2' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'MAX gained each level' }), { target: { value: '3' } });
    expect(doc().levels).toEqual({ xp: [12], gain: { max_hp: 3 } });
    const death = screen.getByRole('group', { name: 'When the hero dies' });
    await user.click(within(death).getByRole('button', { name: 'Add action' }));
    await user.selectOptions(within(death).getByRole('combobox', { name: 'When the hero dies action 1 type' }), 'end');
    await user.selectOptions(within(death).getByRole('combobox', { name: 'When the hero dies action 1 ending' }), 'lose');
    expect(doc().lose).toEqual([{ end: 'lose' }]);
  });

  it('Characters: adds an enemy that chases, with stats, a drop and a death event', async () => {
    const user = userEvent.setup();
    const { doc } = await open(characters, withItem());
    await user.click(screen.getByRole('button', { name: 'Add character' }));
    await user.click(screen.getByRole('checkbox', { name: 'Friendly' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Brain' }), 'chase');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'HP' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'XP' }), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'Add drop' }));
    const death = screen.getByRole('group', { name: 'When it dies' });
    await user.click(within(death).getByRole('button', { name: 'Add action' }));
    await user.selectOptions(within(death).getByRole('combobox', { name: 'When it dies action 1 type' }), 'set');
    await user.clear(within(death).getByRole('combobox', { name: 'When it dies action 1 flag' }));
    await user.type(within(death).getByRole('combobox', { name: 'When it dies action 1 flag' }), 'won-fight');
    expect(doc().kinds![0]).toEqual({
      id: 'character-1',
      name: 'Character 1',
      sprite: 2,
      brain: 'chase',
      stats: { hp: 5 },
      xp: 3,
      drops: [{ item: 'gem' }],
      death: [{ set: 'won-fight' }],
    });
  });

  it('Items: adds a potion that heals, and a sword worn in a slot', async () => {
    const user = userEvent.setup();
    const { doc } = await open(items);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const use = screen.getByRole('group', { name: 'When it is used' });
    await user.click(within(use).getByRole('button', { name: 'Add action' }));
    await user.selectOptions(within(use).getByRole('combobox', { name: 'When it is used action 1 type' }), 'heal');
    expect(doc().items![0]!.use).toEqual([{ heal: 5 }]);
    await user.click(screen.getByRole('button', { name: 'Add slot' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kind of item' }), 'equip');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'ATK bonus' }), { target: { value: '2' } });
    expect(doc().slots).toEqual(['slot-1']);
    expect(doc().items![1]).toEqual({ id: 'item-2', name: 'Item 2', icon: 2, kind: 'equip', slot: 'slot-1', bonus: { atk: 2 } });
  });

  it('Dialogue: writes lines, a choice that jumps, and a line that only shows with a flag', async () => {
    const user = userEvent.setup();
    const { doc } = await open(dialogue);
    await user.click(screen.getByRole('button', { name: 'Add dialogue' }));
    await user.clear(screen.getByRole('textbox', { name: 'Line 1 text' }));
    await user.type(screen.getByRole('textbox', { name: 'Line 1 text' }), 'Will you help?');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.type(screen.getByRole('textbox', { name: 'Line 2 id' }), 'yes');
    await user.click(screen.getByRole('button', { name: 'Add choice to line 1' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Line 1 choice 1 goes to' }), 'yes');
    const line2 = screen.getByRole('group', { name: 'Line 2' });
    await user.click(within(line2).getByRole('button', { name: 'Add condition' }));
    expect(doc().dialogue![0]).toEqual({
      id: 'talk-1',
      lines: [
        { text: 'Will you help?', choices: [{ text: 'OK', goto: 'yes' }] },
        { id: 'yes', text: '...', if: [{ flag: 'flag' }] },
      ],
    });
  });

  it('Quests: adds a quest whose stage wants an item, and finishes with a win', async () => {
    const user = userEvent.setup();
    const { doc } = await open(quests, withItem());
    await user.click(screen.getByRole('button', { name: 'Add quest' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stage 1 goal' }), 'collect');
    const done = screen.getByRole('group', { name: 'When stage 1 is done' });
    await user.click(within(done).getByRole('button', { name: 'Add action' }));
    await user.selectOptions(within(done).getByRole('combobox', { name: 'When stage 1 is done action 1 type' }), 'end');
    expect(doc().quests![0]).toEqual({ id: 'quest-1', title: 'Quest 1', stages: [{ log: 'What to do.', goal: { collect: 'gem' }, done: [{ end: 'win' }] }] });
  });

  it('Rooms: a trigger runs an event', async () => {
    const user = userEvent.setup();
    const { doc } = await open(rooms);
    await user.click(screen.getByRole('radio', { name: 'Place' }));
    await user.click(screen.getByRole('radio', { name: 'Trigger' }));
    click(/^Room start/, 3, 3, 16);
    const trigger = screen.getByRole('group', { name: 'Trigger' });
    await user.click(within(trigger).getByRole('button', { name: 'Add action' }));
    await user.selectOptions(within(trigger).getByRole('combobox', { name: 'Trigger action 1 type' }), 'hurt');
    expect(doc().rooms[0]!.triggers).toEqual([{ x: 3, y: 3, do: [{ hurt: 1 }] }]);
  });

  it('Problems: lists what is wrong', async () => {
    const broken = parseGame(data).doc;
    broken.start.room = 'nowhere';
    await open(problems, JSON.stringify(broken));
    expect(screen.getByRole('list', { name: 'Problems' })).toHaveTextContent('The start room "nowhere" is gone.');
  });

  it('Play: shows why a game cannot play', async () => {
    const user = userEvent.setup();
    const broken = parseGame(data).doc;
    broken.rooms[0]!.actors = [{ kind: 'nobody', x: 1, y: 1 }];
    await open(play, JSON.stringify(broken, null, 1).replace('"kind":"nobody"', '"kind": "nobody"'));
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(`This game can't play yet: rooms[0].actors[0].kind: no kind "nobody"`);
  });

  it('Play: starts the engine and shows where the hero is', async () => {
    const user = userEvent.setup();
    await open(play);
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument();
    act(() => {
      for (let i = 0; i < 15; i++) engine.onStep!({ state: 'playing', room: 'start', x: 3, y: 4, hp: 9, level: 2, stats: { max_hp: 10 }, quests: {}, flags: [] });
    });
    expect(screen.getByLabelText('Game state')).toHaveTextContent('start 3, 4 · HP 9/10 · level 2');
  });
});
