// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { beatEngine } from '../engines/beat';
import { bitsyEngine } from '../engines/bitsy';
import { sharedAgentTools } from './shared';

// docs/get-started/ai.md lists every tool an agent gets, so it stays in step with the code.
const page = readFileSync(fileURLToPath(new URL('../../../docs/get-started/ai.md', import.meta.url)), 'utf8');
const tools = [...sharedAgentTools, ...(bitsyEngine.agentTools ?? []), ...(beatEngine.agentTools ?? [])];

describe('agent tools docs', () => {
  it.each(tools.map((tool) => tool.name))('lists %s', (name) => {
    expect(page).toContain(`\`${name}\``);
  });

  it('has unique tool names', () => {
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
  });
});
