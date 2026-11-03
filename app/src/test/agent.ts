import { vi } from 'vitest';
import type { World } from '../bitsy';
import { createMemoryStore } from '../chili-api';
import { createFakePlatform, type FakePlatform } from '../chili-api/fake-platform';
import type { WebMcpResult, WebMcpTool } from '../agent/webmcp';
import { createCreator, type CreatorOptions } from '../creator';
import type { Player } from '../player';
import type { SoundPreview } from '../sound/preview';
import { blankGame, fakePlayer, fakeSound } from './creator';

/** A browser's `document.modelContext` that keeps the tools, so tests can call them. */
export function fakeModelContext() {
  const tools = new Map<string, WebMcpTool>();
  async function execute(name: string, input: object) {
    const tool = tools.get(name);
    if (!tool) throw new Error(`No tool is called ${name}`);
    return (await tool.execute(input, {})) as WebMcpResult;
  }
  return {
    tools,
    registerTool(tool: WebMcpTool, options: { signal?: AbortSignal } = {}) {
      tools.set(tool.name, tool);
      options.signal?.addEventListener('abort', () => tools.delete(tool.name));
    },
    /** Calls a tool and gives back its JSON answer, or `{ error }`. */
    async call(name: string, input: object = {}): Promise<any> {
      const result = await execute(name, input);
      const text = (result.content[0] as { text: string }).text;
      return result.isError ? { error: text } : JSON.parse(text);
    },
    /** The PNG pictures a tool sent back, base64. */
    async images(name: string, input: object = {}): Promise<string[]> {
      const result = await execute(name, input);
      return result.content.flatMap((part) => (part.type === 'image' ? [part.data] : []));
    },
  };
}

export type FakeModelContext = ReturnType<typeof fakeModelContext>;

export interface AgentCreatorOptions extends Partial<CreatorOptions> {
  /** A game to open first. */
  data?: string;
  signedIn?: boolean;
  platform?: FakePlatform;
  /** What the person answers when a tool asks first. */
  answer?: boolean;
}

/** The creator with its agent tools on a fake model context, and a game open when `data` is given. */
export async function agentCreator({ data, signedIn = true, platform = createFakePlatform(), answer = true, ...options }: AgentCreatorOptions = {}) {
  if (signedIn) localStorage.setItem('chili.accessToken', 'good-token');
  const game = data === undefined ? undefined : platform.addGame({ title: 'Test game', data });
  const modelContext = fakeModelContext();
  const player = fakePlayer();
  const confirm = vi.fn(async () => answer);
  const download = vi.fn();
  const creator = createCreator({
    apiBase: 'https://api.test/api',
    parent: null,
    origin: 'http://localhost',
    fetch: platform.fetch,
    localStore: createMemoryStore(),
    createPlayer: (paint) => {
      player.paint = paint;
      return player as unknown as Player;
    },
    sound: fakeSound() as unknown as SoundPreview,
    tour: false,
    modelContext,
    confirm,
    download,
    ...options,
  });
  await creator.projects.start(game ? String(game.id) : undefined);
  /** The open game's document as it is now. */
  const doc = <Doc = World>(): Doc => {
    const { open } = creator.projects.getState();
    if (open.status !== 'ready') throw new Error('no game is open');
    return open.doc as Doc;
  };
  return { creator, platform, player, confirm, modelContext, download, call: modelContext.call, images: modelContext.images, doc, game };
}

export { blankGame };
