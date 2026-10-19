import { createProfileService, createTransport } from './chili-api';
import { createEmbedBridge } from './embed/bridge';
import { createCommandRegistry, createToolRegistry } from './plugin-api';
import { builtInTools } from './tools';

export interface CreatorOptions {
  apiBase: string;
  /** The platform page around the iframe, or null when running alone. */
  parent: Window | null;
  origin: string;
}

/** Everything the shell needs, wired once. Tests build their own. */
export function createCreator({ apiBase, parent, origin }: CreatorOptions) {
  const bridge = createEmbedBridge({ win: window, parent, origin });
  const transport = createTransport({
    baseUrl: apiBase,
    tokens: { getToken: (reason) => bridge.requestToken(reason) },
  });
  const tools = createToolRegistry();
  builtInTools.forEach((tool) => tools.register(tool));
  return {
    bridge,
    transport,
    profile: createProfileService(transport),
    tools,
    commands: createCommandRegistry(),
  };
}

export type Creator = ReturnType<typeof createCreator>;
