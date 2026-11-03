import type { Creator } from '../creator';
import type { JsonSchema } from './schema';

/** What an agent tool can reach: the creator, and the person at the screen. */
export interface AgentContext {
  creator: Creator;
  /** Asks the person a yes or no question; true when they say yes. */
  confirm(question: string): Promise<boolean>;
  /** Hands a file to the person's browser to save. */
  download(name: string, content: BlobPart, type: string): void;
}

/**
 * One thing an AI agent can do in the creator, offered to it over WebMCP.
 * `run` gets input that fits `inputSchema`; it throws an Error with a short,
 * plain message when it cannot do what was asked, and returns JSON-able data.
 */
export interface AgentTool<Input = any> {
  /** snake_case, unique; engine tools start with the engine's id. */
  name: string;
  title: string;
  /** What it does and when to use it, for the model. */
  description: string;
  inputSchema: JsonSchema;
  /** Only reads; the agent may call it freely. */
  readOnly?: boolean;
  /** Asks the person first (release, delete). */
  asksFirst?: boolean;
  run(input: Input, context: AgentContext): unknown;
}

/** A tool's answer with a PNG picture, which agents can look at. */
export class PictureResult {
  constructor(
    readonly png: Uint8Array,
    readonly data: unknown,
  ) {}
}

export function picture(png: Uint8Array, data: unknown = {}): PictureResult {
  return new PictureResult(png, data);
}

/** Typed helper for tool modules. */
export function defineAgentTool<Input>(tool: AgentTool<Input>): AgentTool<Input> {
  return tool;
}
