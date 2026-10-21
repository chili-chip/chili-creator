import type { ToolDefinition } from '../plugin-api';
import colors from './colors';
import library from './library';
import paint from './paint';
import play from './play';
import projects from './projects';
import room from './room';

/**
 * Built-in tools, registered exactly like future ones. A fresh workspace
 * opens them in this order, so a tool's `defaultReference` comes first.
 */
export const builtInTools: ToolDefinition[] = [projects, room, paint, library, colors, play];
