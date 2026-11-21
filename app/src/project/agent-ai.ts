import { AI_USE_KINDS, type AiUseKind } from '../chili-api';

// What an AI agent changed in each game through the creator's WebMCP tools
// (#76, decision 0006 in chili-business#52: AI content is allowed but tagged).
// The release answer has to include these kinds, so a game an agent worked on
// is never released as "No AI" by mistake. Kept on this device, next to the
// signed-out projects, under one key: { [project id]: kinds }.

export const AGENT_AI_KEY = 'agent-ai';

export type AgentAiRecord = Record<string, AiUseKind[]>;

const ORDER = AI_USE_KINDS.map((kind) => kind.value);

/** `kinds` and `more` together, once each, in the platform's order. */
export function withKinds(kinds: readonly AiUseKind[] | undefined, more: readonly AiUseKind[]): AiUseKind[] {
  const all = new Set([...(kinds ?? []), ...more]);
  return ORDER.filter((kind) => all.has(kind));
}

/** The recorded kinds that `answer` leaves out. */
export function agentAiMissing(recorded: readonly AiUseKind[], answer: readonly AiUseKind[]): AiUseKind[] {
  return recorded.filter((kind) => !answer.includes(kind));
}

function list(words: string[]): string {
  if (words.length < 3) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

/** Why an answer that leaves out `missing` is refused. */
export function agentAiProblem(missing: readonly AiUseKind[]): string {
  const words = AI_USE_KINDS.filter((kind) => missing.includes(kind.value)).map((kind) => kind.short);
  const them = missing.length === 1 ? 'it' : 'them';
  return `An AI agent changed this game’s ${list(words)} in the creator, so the AI answer has to include ${them}.`;
}

/** "art and text", for the release form. */
export function agentAiWords(kinds: readonly AiUseKind[]): string {
  return list(AI_USE_KINDS.filter((kind) => kinds.includes(kind.value)).map((kind) => kind.short));
}

/** A saved record, with anything it does not know left out. */
export function readAgentAi(saved: unknown): AgentAiRecord {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const record: AgentAiRecord = {};
  for (const [id, kinds] of Object.entries(saved)) {
    if (!Array.isArray(kinds)) continue;
    const known = withKinds(undefined, kinds.filter((kind): kind is AiUseKind => ORDER.includes(kind)));
    if (known.length) record[id] = known;
  }
  return record;
}
