import { checkInput } from './schema';
import { PictureResult, type AgentContext, type AgentTool } from './types';

// WebMCP (https://webmachinelearning.github.io/webmcp/): a page offers tools
// to AI agents through `document.modelContext` (`navigator.modelContext` in
// Chrome's first preview). Each tool answers like an MCP tool call, so any
// agent that speaks MCP can read it.

export type WebMcpContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };

export interface WebMcpResult {
  content: WebMcpContent[];
  isError?: boolean;
}

export interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; consequentialHint?: boolean };
  execute(input: object, options: unknown): Promise<WebMcpResult>;
}

export interface ModelContextLike {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): unknown;
  /** Chrome's first preview takes tools away by name; the spec uses the signal. */
  unregisterTool?(name: string): unknown;
}

/** The browser's model context, or null when it has no WebMCP. */
export function findModelContext(win: Window = window): ModelContextLike | null {
  type WithContext = { modelContext?: ModelContextLike };
  return (win.document as unknown as WithContext).modelContext ?? (win.navigator as unknown as WithContext).modelContext ?? null;
}

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

const text = (value: unknown): WebMcpContent => ({ type: 'text', text: JSON.stringify(value ?? { ok: true }) });

/** Runs a tool and turns what happens into an MCP result. Errors are results too: browsers hide rejection reasons. */
export async function runTool(tool: AgentTool, input: unknown, context: AgentContext): Promise<WebMcpResult> {
  const problem = checkInput(tool.inputSchema, input);
  if (problem) return { content: [{ type: 'text', text: problem }], isError: true };
  try {
    const value = await tool.run(input ?? {}, context);
    if (value instanceof PictureResult) {
      return { content: [text(value.data), { type: 'image', data: base64(value.png), mimeType: 'image/png' }] };
    }
    return { content: [text(value)] };
  } catch (err) {
    return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
}

/** Offers the tools to agents. Returns a function that takes them away again. */
export function connectAgentTools(modelContext: ModelContextLike, tools: AgentTool[], context: AgentContext): () => void {
  const controller = new AbortController();
  for (const tool of tools) {
    const registered: WebMcpTool = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: !!tool.readOnly, ...(tool.asksFirst ? { consequentialHint: true } : {}) },
      execute: (input) => runTool(tool, input, context),
    };
    try {
      const done = modelContext.registerTool(registered, { signal: controller.signal });
      if (done instanceof Promise) done.catch((err: unknown) => console.warn(`Could not offer ${tool.name} to agents:`, err));
    } catch (err) {
      console.warn(`Could not offer ${tool.name} to agents:`, err);
    }
  }
  return () => {
    controller.abort();
    for (const tool of tools) modelContext.unregisterTool?.(tool.name);
  };
}
