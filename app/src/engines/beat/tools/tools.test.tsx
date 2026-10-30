import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { placeOnScreen } from '../../../test/canvas';
import { renderTool } from '../../../test/creator';
import { blankGame, parseGame, type Game } from '../model';
import { selectionOf } from '../state';
import game from './game';
import play from './play';
import rules from './rules';
import screens from './screens';
import sounds from './sounds';
import problems from './problems';
import things from './things';

vi.mock('../player', () => ({
  BEAT_BUTTONS: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32 },
  loadEngine: vi.fn(async () => ({
    load: (text: string) => (text.includes('"become": "nothing"') ? 'rules[0].do[0].become: must be a thing key' : null),
    start: vi.fn(),
    stop: vi.fn(),
    press: vi.fn(),
    enableSound: vi.fn(),
    muted: false,
    onStep: null,
  })),
}));

const data = blankGame('Test');

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

describe('Chili Beat tools', () => {
  it('Things: adds a thing and draws on it', async () => {
    const user = userEvent.setup();
    const { doc } = await open(things);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(doc().things.map((t) => t.key)).toEqual(['@', '#', 'a']);
    await user.click(screen.getByRole('radio', { name: 'Colour 3' }));
    click(/^Drawing of Thing 1/, 2, 1, 8);
    expect(doc().things[2]!.frames[0]![1]).toBe('00300000');
    await user.click(screen.getByRole('checkbox', { name: 'Is you' }));
    expect(doc().things[2]!.you).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Add frame 2' }));
    expect(doc().things[2]!.frames).toHaveLength(2);
  });

  it('Screens: paints the picked thing, erases, and adds a screen on the map', async () => {
    const user = userEvent.setup();
    const { doc } = await open(screens);
    await user.click(screen.getByRole('radio', { name: 'Wall' }));
    click(/^Screen start/, 5, 5, 16);
    expect(doc().screens[0]!.things[5]![5]).toBe('#');
    await user.click(screen.getByRole('radio', { name: 'Eraser' }));
    click(/^Screen start/, 5, 5, 16);
    expect(doc().screens[0]!.things[5]![5]).toBe('.');
    await user.click(screen.getByRole('button', { name: 'Add a screen at 1, 0' }));
    expect(doc().screens.map((s) => s.id)).toEqual(['start', 'screen-1']);
    expect(screen.getByRole('button', { name: 'Screen screen-1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Rules: adds a card, changes its trigger and action, and orders cards', async () => {
    const user = userEvent.setup();
    const { doc } = await open(rules);
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    const card = screen.getByRole('listitem', { name: 'Rule 2' });
    await user.selectOptions(within(card).getByRole('combobox', { name: 'Trigger' }), 'bump');
    expect(doc().rules[1]!.when).toEqual({ bump: ['you', '@'] });
    await user.selectOptions(within(card).getByRole('combobox', { name: 'Bumped' }), '#');
    await user.selectOptions(within(card).getByRole('combobox', { name: 'Action' }), 'vanish');
    await user.selectOptions(within(card).getByRole('combobox', { name: 'Who' }), 'bumped');
    expect(doc().rules[1]).toEqual({ when: { bump: ['you', '#'] }, do: [{ vanish: true, who: 'bumped' }] });
    await user.click(within(card).getByRole('button', { name: 'If chance' }));
    expect(doc().rules[1]!.if).toEqual([{ chance: 2 }]);
    await user.click(screen.getByRole('button', { name: 'Move rule 2 up' }));
    expect(doc().rules[0]!.when).toEqual({ bump: ['you', '#'] });
  });

  it('Rules: adds a recipe, with the things and counters it needs', async () => {
    const user = userEvent.setup();
    const { doc } = await open(rules);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a recipe' }), 'door-and-key');
    expect(doc().things.map((t) => t.name)).toEqual(['Hero', 'Wall', 'Key', 'Door']);
    expect(doc().counters!.map((c) => c.name)).toEqual(['Keys']);
    expect(screen.getAllByRole('listitem', { name: /^Rule/ })).toHaveLength(3);
  });

  it('Rules: lights up the cards that just ran', async () => {
    const { creator } = await open(rules);
    act(() => selectionOf(creator).set({ lit: [0] }));
    expect(screen.getByRole('listitem', { name: 'Rule 1' })).toHaveAttribute('data-lit', 'true');
  });

  it('Game: picks colours, tempo, turns and counters', async () => {
    const user = userEvent.setup();
    const { doc } = await open(game);
    await user.click(screen.getByRole('radio', { name: 'Colour 2' }));
    await user.click(screen.getByRole('button', { name: 'Sweetie 3 #ef7d57' }));
    expect(doc().palette).toEqual([0, 6, 3, 12]);
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '7' } });
    expect(doc().tempo).toBe(7);
    await user.click(screen.getByRole('radio', { name: 'In turns' }));
    expect(doc().time).toBe('turns');
    await user.click(screen.getByRole('button', { name: 'Add counter' }));
    expect(doc().counters).toEqual([{ id: 'counter-1', name: 'Counter 1', icon: '@', start: 0 }]);
  });

  it('Sounds: adds a sound effect and a tune, and writes notes', async () => {
    const user = userEvent.setup();
    const { doc } = await open(sounds);
    await user.click(screen.getByRole('button', { name: 'Add sound' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'blip-1 preset' }), 'coin');
    expect(doc().blips).toEqual([{ id: 'blip-1', preset: 'coin', pitch: 4, length: 3, slide: 0 }]);
    await user.click(screen.getByRole('button', { name: 'Add tune' }));
    await user.click(screen.getByRole('gridcell', { name: 'Note 5, step 1' }));
    await user.click(screen.getByRole('gridcell', { name: 'Kick, step 1' }));
    expect(doc().tunes![0]!.lead[0]).toBe(5);
    expect(doc().tunes![0]!.beat[0]).toBe(8);
    await user.click(screen.getByRole('button', { name: 'Play tune' }));
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('Problems: lists what is wrong', async () => {
    const broken = parseGame(data).doc;
    broken.things[0]!.you = false;
    await open(problems, JSON.stringify(broken));
    expect(screen.getByRole('list', { name: 'Problems' })).toHaveTextContent('Nothing on the start screen is "you"');
  });

  it('Play: shows why a game cannot play', async () => {
    const user = userEvent.setup();
    const broken = parseGame(data).doc;
    broken.rules = [{ when: { start: true }, do: [{ become: 'nothing' }] }];
    await open(play, JSON.stringify(broken, null, 2).replace('"become":"nothing"', '"become": "nothing"'));
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("This game can't play yet: rules[0].do[0].become: must be a thing key");
  });

  it('Play: starts the engine with the open game', async () => {
    const user = userEvent.setup();
    await open(play);
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });
});
