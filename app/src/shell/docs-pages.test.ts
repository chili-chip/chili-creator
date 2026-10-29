// @vitest-environment node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { builtInTools } from '../tools';

// Help links each tool to its page on creator.chilichip.eu, built from docs/tools/.
describe('docs pages', () => {
  it.each(builtInTools.map((tool) => tool.id))('docs/tools/%s.md exists', (id) => {
    expect(existsSync(fileURLToPath(new URL(`../../../docs/tools/${id}.md`, import.meta.url)))).toBe(true);
  });
});
