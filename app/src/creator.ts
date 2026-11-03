import type { World } from './bitsy';
import { toast } from 'sonner';
import {
  createIndexedDbStore,
  createLocalProjects,
  createPlatformProjects,
  createProfileService,
  createTransport,
  type KeyValueStore,
} from './chili-api';
import { connectAgentTools, findModelContext, sharedAgentTools, type ModelContextLike } from './agent';
import { createEmbedBridge } from './embed/bridge';
import { download as saveFile } from './export/files';
import { createI18n, type Catalog } from './i18n';
import { createCommandRegistry, createToolRegistry } from './plugin-api';
import { createPlayer, type Player } from './player';
import { editingCommands } from './project/commands';
import { createEditorState } from './project/editor';
import { createProjectStore, type NoticeKind } from './project/store';
import { createSoundPreview, type SoundPreview } from './sound/preview';
import { beatEngine } from './engines/beat';
import { bitsyEngine } from './engines/bitsy';
import { createEngineRegistry } from './engines/registry';
import type { EditorDefinition, EngineModule } from './engines/types';
import { shellTools } from './tools';

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
  /** The languages on offer; English and those with a catalog by default. */
  languages?: string[];
  /** Engines the creator knows. The first one opens games that have no engine. */
  engines?: EngineModule[];
  /** Engines offered for new games; more can be turned on with `?engines=` in `search`. */
  enabledEngines?: string[];
  search?: string;
  /** Opens this engine's editor at once (`?engine=` from the platform) instead of the engine choice. */
  engine?: string;
  /** Where to offer tools to AI agents (WebMCP); the browser's when it has one. Null offers none. */
  modelContext?: ModelContextLike | null;
  /** Asks the person before an agent releases or deletes a game. */
  confirm?: (question: string) => Promise<boolean>;
  /** Hands a file to the browser to save. */
  download?: (name: string, content: BlobPart, type: string) => void;
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
  languages,
  engines: engineModules = [bitsyEngine, beatEngine as EngineModule],
  enabledEngines = ['bitsy', 'beat'],
  search = typeof location === 'undefined' ? '' : location.search,
  engine: initialEngine,
  modelContext = typeof window === 'undefined' ? null : findModelContext(),
  confirm = async (question) => window.confirm(question),
  download = saveFile,
}: CreatorOptions) {
  const engines = createEngineRegistry(engineModules, { enabled: enabledEngines, search });
  const i18n = createI18n({ ...(loadCatalog ? { load: loadCatalog } : {}), ...(languages ? { available: languages } : {}) });
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
    engines,
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
    if (open.status === 'ready' && open.engine === 'bitsy') editor.reset(open.doc as World);
  });

  // The shell's tools, plus the tools of the open game's editor.
  const tools = createToolRegistry();
  shellTools.forEach((tool) => tools.register(tool));
  const activeEditor = createActiveEditor();
  let unregisterEditor: (() => void)[] = [];
  function showEditor(next: EditorDefinition) {
    if (next === activeEditor.get()) return;
    unregisterEditor.forEach((fn) => fn());
    unregisterEditor = next.tools.map((tool) => tools.register(tool));
    activeEditor.set(next);
  }
  // The chosen engine's editor; the default one behind the engine choice.
  const chosenEditor = () => (engines.get(projects.getState().engine ?? undefined) ?? engines.default()).editors[0]!;
  if (initialEngine && engines.get(initialEngine)) void projects.chooseEngine(initialEngine);
  showEditor(chosenEditor());
  projects.subscribe(() => showEditor(chosenEditor()));

  const commands = createCommandRegistry();
  editingCommands({ projects, editor }).forEach((command) => commands.register(command));

  // Tools for AI agents: the shared ones and every offered engine's, so an
  // agent sees one list whichever game is open.
  const agentTools = [...sharedAgentTools, ...engines.offered().flatMap((engine) => engine.agentTools ?? [])];
  const creator = {
    engines,
    activeEditor,
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
    agentTools,
  };
  if (modelContext) connectAgentTools(modelContext, agentTools, { creator, confirm, download });
  return creator;
}

export type Creator = ReturnType<typeof createCreator>;

/** The editor whose tools are showing, for the shell to follow. */
function createActiveEditor() {
  let current: EditorDefinition | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current!,
    set(next: EditorDefinition) {
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
