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
import { createI18n, type Catalog } from './i18n';
import { createCommandRegistry, createToolRegistry } from './plugin-api';
import { createPlayer, type Player } from './player';
import { editingCommands } from './project/commands';
import { createEditorState } from './project/editor';
import { createProjectStore, type NoticeKind } from './project/store';
import { createSoundPreview, type SoundPreview } from './sound/preview';
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
  /** Plays tunes and blips in the sound tools. */
  sound?: SoundPreview;
  /** Offers the first-run tour to people who have not seen it. */
  tour?: boolean;
  /** Loads a language's translations; the built-in catalogs by default. */
  loadCatalog?: (language: string) => Promise<Catalog>;
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
  sound = createSoundPreview(),
  tour = true,
  loadCatalog,
}: CreatorOptions) {
  const i18n = createI18n(loadCatalog ? { load: loadCatalog } : {});
  void i18n.start();
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

  // A newly opened game starts where its avatar is.
  const editor = createEditorState();
  let shown: string | null = null;
  projects.subscribe(() => {
    const { open } = projects.getState();
    const id = open.status === 'ready' ? open.project.id : null;
    if (id === shown) return;
    shown = id;
    if (open.status === 'ready') editor.reset(open.world);
  });

  const tools = createToolRegistry();
  builtInTools.forEach((tool) => tools.register(tool));
  const commands = createCommandRegistry();
  editingCommands({ projects, editor }).forEach((command) => commands.register(command));
  return {
    bridge,
    transport,
    profile,
    projects,
    editor,
    notify,
    i18n,
    createPlayer: makePlayer,
    sound,
    tour,
    initialProject,
    tools,
    commands,
  };
}

export type Creator = ReturnType<typeof createCreator>;
