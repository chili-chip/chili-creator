import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { createWorld, serialize, type World } from '../bitsy';
import { vi } from 'vitest';
import { createMemoryStore } from '../chili-api';
import { createFakePlatform, type FakePlatform } from '../chili-api/fake-platform';
import { createCreator, type CreatorOptions } from '../creator';
import type { Player, PlayerState } from '../player';
import { App } from '../shell/App';
import { CreatorProvider } from '../shell/creator-context';
import type { PreviewState, SoundPreview } from '../sound/preview';

/** A player that records what it was asked to do. */
export function fakePlayer() {
  let state: PlayerState = { status: 'idle' };
  const listeners = new Set<(state: PlayerState) => void>();
  const set = (next: PlayerState) => {
    state = next;
    listeners.forEach((listener) => listener(next));
  };
  const player = {
    played: [] as string[],
    pressed: [] as [number, boolean][],
    state: () => state,
    subscribe(listener: (state: PlayerState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: vi.fn((data: string) => {
      player.played.push(data);
      set({ status: 'playing' });
    }),
    stop: vi.fn(() => set({ status: 'idle' })),
    press: vi.fn((button: number, down: boolean) => player.pressed.push([button, down])),
    tap: vi.fn(),
    dispose: vi.fn(),
    set,
  };
  return player;
}

/** A sound preview that records what it was asked to play. */
export function fakeSound() {
  let state: PreviewState = { playing: null };
  const listeners = new Set<(state: PreviewState) => void>();
  const set = (next: PreviewState) => {
    state = next;
    listeners.forEach((listener) => listener(next));
  };
  return {
    playTune: vi.fn((tune: { id: string }) => set({ playing: 'tune', id: tune.id, bar: 0, beat: 0 })),
    playBlip: vi.fn((blip: { id: string }) => set({ playing: 'blip', id: blip.id })),
    playNote: vi.fn(),
    stop: vi.fn(() => set({ playing: null })),
    state: () => state,
    subscribe(listener: (state: PreviewState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose: vi.fn(),
    set,
  };
}

export interface TestCreatorOptions extends Partial<CreatorOptions> {
  signedIn?: boolean;
  platform?: FakePlatform;
}

/** The whole creator against a fake platform, rendered. */
export function renderCreator({ signedIn = true, platform = createFakePlatform(), ...options }: TestCreatorOptions = {}) {
  if (signedIn) localStorage.setItem('chili.accessToken', 'good-token');
  const player = fakePlayer();
  const creator = createCreator({
    apiBase: 'https://api.test/api',
    parent: null,
    origin: 'http://localhost',
    fetch: platform.fetch,
    localStore: createMemoryStore(),
    createPlayer: () => player as unknown as Player,
    sound: fakeSound() as unknown as SoundPreview,
    ...options,
  });
  const view = render(<App creator={creator} />);
  return { creator, platform, player, ...view };
}

/** The classic editor's new game: a room, the avatar, a cat, tea and a key. */
export const blankGame = serialize(createWorld({ title: 'Test game' }));

/** One tool on its own, with a game open. */
export async function renderTool(Tool: ComponentType, { data = blankGame }: { data?: string } = {}) {
  localStorage.setItem('chili.accessToken', 'good-token');
  const platform = createFakePlatform();
  const game = platform.addGame({ title: 'Test game', data });
  const sound = fakeSound();
  const creator = createCreator({
    apiBase: 'https://api.test/api',
    parent: null,
    origin: 'http://localhost',
    fetch: platform.fetch,
    localStore: createMemoryStore(),
    createPlayer: () => fakePlayer() as unknown as Player,
    sound: sound as unknown as SoundPreview,
  });
  await creator.projects.start(String(game.id));
  const view = render(
    <CreatorProvider value={creator}>
      <Tool />
    </CreatorProvider>,
  );
  /** The open world as it is now. */
  const world = (): World => {
    const { open } = creator.projects.getState();
    if (open.status !== 'ready') throw new Error('no game is open');
    return open.world;
  };
  return { creator, platform, world, sound, ...view };
}
