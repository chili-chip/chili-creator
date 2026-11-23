import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderTool } from '../../../test/creator';
import { blankGame, parseGame, type Game } from '../model';
import game from './game';
import play from './play';
import problems from './problems';

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

async function open(Tool: { component: React.ComponentType }, text = data) {
  const view = await renderTool(Tool.component, { data: text });
  const doc = () => {
    const state = view.creator.projects.getState().open;
    if (state.status !== 'ready') throw new Error('not open');
    return state.doc as Game;
  };
  return { ...view, doc };
}

describe('Chili RPG tools', () => {
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

  it('Game: sets the hero stats and the XP for each level', async () => {
    const user = userEvent.setup();
    const { doc } = await open(game);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'ATK at the start' }), { target: { value: '4' } });
    expect(doc().stats.find((s) => s.id === 'atk')!.start).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Add level' }));
    expect(doc().levels).toEqual({ xp: [10] });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'XP for level 2' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'MAX gained each level' }), { target: { value: '3' } });
    expect(doc().levels).toEqual({ xp: [12], gain: { max_hp: 3 } });
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
