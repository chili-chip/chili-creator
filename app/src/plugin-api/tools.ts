import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createRegistry } from './registry';

/** Where a tool opens the first time, relative to the workspace. */
export type ToolPosition = 'center' | 'left' | 'right' | 'below';

export interface ToolDefinition {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Rendered inside a workspace panel. */
  component: ComponentType;
  defaultPosition?: ToolPosition;
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
