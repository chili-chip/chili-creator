import { describe, expect, it } from 'vitest';
import { AGENT_AI_KEY, agentAiMissing, agentAiProblem, readAgentAi, withKinds } from './agent-ai';

describe('agent AI record (#76)', () => {
  it('keeps kinds in the platform order, once each', () => {
    expect(withKinds(['code', 'art'], ['text', 'art'])).toEqual(['art', 'text', 'code']);
    expect(withKinds(undefined, [])).toEqual([]);
  });

  it('names the recorded kinds an answer leaves out', () => {
    expect(agentAiMissing(['art', 'text'], ['art'])).toEqual(['text']);
    expect(agentAiMissing(['art'], ['art', 'code'])).toEqual([]);
    expect(agentAiMissing([], [])).toEqual([]);
  });

  it('explains what the answer has to include', () => {
    expect(agentAiProblem(['art', 'text'])).toBe(
      'An AI agent changed this game’s art and text in the creator, so the AI answer has to include them.',
    );
    expect(agentAiProblem(['sound'])).toBe(
      'An AI agent changed this game’s sound and music in the creator, so the AI answer has to include it.',
    );
    expect(agentAiProblem(['art', 'sound', 'code'])).toMatch(/game’s art, sound and music, and code in/);
  });

  it('reads a saved record and drops what it does not know', () => {
    expect(AGENT_AI_KEY).toBe('agent-ai');
    expect(readAgentAi({ '7': ['text', 'art', 'bogus'], '8': 'art', '9': [] })).toEqual({ '7': ['art', 'text'] });
    expect(readAgentAi(undefined)).toEqual({});
    expect(readAgentAi('junk')).toEqual({});
  });
});
