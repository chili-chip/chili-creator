import { toast } from 'sonner';
import {
  createIndexedDbStore,
  createLocalProjects,
  createPlatformProjects,
  createProfileService,
  createTransport,
  type KeyValueStore,
} from './chili-api';
import { createEmbedBridge } from './embed/bridge';
import { createCommandRegistry, createToolRegistry } from './plugin-api';
import { createPlayer, type Player } from './player';
import { createProjectStore, type NoticeKind } from './project/store';
import { builtInTools } from './tools';

export interface CreatorOptions {
  apiBase: string;
  /** The platform page around the iframe, or null when running alone. */
  parent: Window | null;
  origin: string;
  /** The project to open first (`?project=` from the platform). */
  initialProject?: string;
  fetch?: typeof fetch;
  /** Where signed-out games are kept; IndexedDB by default. */
  localStore?: KeyValueStore;
  /** Makes a player that paints into `paint`; the real one runs citsy in a worker. */
  createPlayer?: (paint: (pixels: Uint8ClampedArray) => void) => Player;
}

/** Everything the shell needs, wired once. Tests build their own. */
export function createCreator({
  apiBase,
  parent,
  origin,
  initialProject,
  fetch: fetchImpl,
  localStore,
  createPlayer: makePlayer = (paint) => createPlayer({ paint }),
}: CreatorOptions) {
  const bridge = createEmbedBridge({ win: window, parent, origin });
  const transport = createTransport({
    baseUrl: apiBase,
    tokens: { getToken: (reason) => bridge.requestToken(reason) },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  const profile = createProfileService(transport);

  // Inside the platform its own toasts show messages; alone, ours do.
  function notify(kind: NoticeKind, message: string) {
    if (bridge.embedded) bridge.post({ type: 'chili-toast', kind, message });
    else if (kind === 'error') toast.error(message);
    else if (kind === 'success') toast.success(message);
    else toast(message);
  }

  const projects = createProjectStore({
    profile,
    platform: createPlatformProjects(transport),
    local: createLocalProjects(localStore ?? createIndexedDbStore()),
    post: (message) => bridge.post(message),
    notify,
  });

  const tools = createToolRegistry();
  builtInTools.forEach((tool) => tools.register(tool));
  return {
    bridge,
    transport,
    profile,
    projects,
    notify,
    createPlayer: makePlayer,
    initialProject,
    tools,
    commands: createCommandRegistry(),
  };
}

export type Creator = ReturnType<typeof createCreator>;
