import type { ToolDefinition } from '../plugin-api';
import welcome from './welcome';

/** Built-in tools, registered exactly like future ones. */
export const builtInTools: ToolDefinition[] = [welcome];
