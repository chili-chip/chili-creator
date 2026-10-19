import type { ToolDefinition } from '../plugin-api';
import play from './play';
import projects from './projects';

/** Built-in tools, registered exactly like future ones. */
export const builtInTools: ToolDefinition[] = [projects, play];
