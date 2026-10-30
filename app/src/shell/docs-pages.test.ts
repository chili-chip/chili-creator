// @vitest-environment node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { beatEngine } from '../engines/beat';
import { bitsyEngine } from '../engines/bitsy';
import { shellTools } from '../tools';
import { toolDocs } from './Help';

// Help links each tool to its page on creator.chilichip.eu, built from docs/.
const pages = [
  ...shellTools.map((tool) => toolDocs(tool.id, 'bitsy')),
  ...[bitsyEngine, beatEngine].flatMap((engine) => engine.editors.flatMap((editor) => editor.tools.map((tool) => toolDocs(tool.id, editor.id)))),
];

describe('docs pages', () => {
  it.each(pages)('%s has a page in docs/', (url) => {
    const path = url.replace('https://creator.chilichip.eu/', '').replace(/\/$/, '.md');
    expect(existsSync(fileURLToPath(new URL(`../../../docs/${path}`, import.meta.url)))).toBe(true);
  });

  it('puts shared tools in Get started and editor tools under their editor', () => {
    expect(toolDocs('projects', 'beat')).toBe('https://creator.chilichip.eu/get-started/projects/');
    expect(toolDocs('room', 'bitsy')).toBe('https://creator.chilichip.eu/editors/bitsy/tools/room/');
    expect(toolDocs('beat-rules', 'beat')).toBe('https://creator.chilichip.eu/editors/beat/tools/beat-rules/');
  });
});
