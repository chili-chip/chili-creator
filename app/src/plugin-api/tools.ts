import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createRegistry } from './registry';

/**
 * Where a tool opens the first time: in the main area, beside or below
 * another panel, or `within` it as another tab.
 */
export type ToolPosition = 'center' | 'left' | 'right' | 'below' | 'within';

export interface ToolDefinition {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Rendered inside a workspace panel. */
  component: ComponentType;
  defaultPosition?: ToolPosition;
  /** The tool `defaultPosition` is relative to; the active panel when it is not open. */
  defaultReference?: string;
  /** Opens as a tab behind the others instead of in front. */
  openInBackground?: boolean;
  /** Opened in a fresh workspace. */
  openByDefault?: boolean;
}

/** Typed helper for tool modules: `export default defineTool({...})`. */
export function defineTool(tool: ToolDefinition): ToolDefinition {
  return tool;
}

export function createToolRegistry() {
  return createRegistry<ToolDefinition>('tool');
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>;
