import type { ToolDefinition } from '../plugin-api';
import blips from './blips';
import colors from './colors';
import dialog from './dialog';
import download from './download';
import exits from './exits';
import find from './find';
import game from './game';
import library from './library';
import paint from './paint';
import play from './play';
import problems from './problems';
import projects from './projects';
import room from './room';
import tunes from './tunes';
import variables from './variables';

/**
 * Built-in tools, registered exactly like future ones. A fresh workspace
 * opens them in this order, so a tool's `defaultReference` comes first.
 */
export const builtInTools: ToolDefinition[] = [
  projects,
  room,
  paint,
  library,
  colors,
  dialog,
  exits,
  variables,
  tunes,
  blips,
  problems,
  play,
  game,
  download,
  find,
];
