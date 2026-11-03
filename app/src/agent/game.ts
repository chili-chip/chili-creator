import type { Creator } from '../creator';
import type { EngineModule } from '../engines/types';

// The open game, for agent tools. Each one fails with a message the agent can act on.

export const NO_GAME = 'No game is open. Open one with open_project or make one with new_game.';

/** The open game: its project, engine and document. */
export function openGame(creator: Creator) {
  const { open } = creator.projects.getState();
  if (open.status !== 'ready') throw new Error(NO_GAME);
  return { project: open.project, engine: creator.engines.get(open.engine)!, doc: open.doc };
}

/** The open game's document, when it is a game of `engineId`. */
export function docOf<Doc>(creator: Creator, engineId: string): Doc {
  const { engine, doc } = openGame(creator);
  if (engine.id !== engineId) {
    const wanted = creator.engines.get(engineId)?.title ?? engineId;
    throw new Error(`The open game is a ${engine.title} game. These tools are for ${wanted} games.`);
  }
  return doc as Doc;
}

/**
 * Changes the open document as one undo step, as the editor's own tools do.
 * When `recipe` throws, nothing changes.
 */
export function editDoc<Doc, Result = void>(creator: Creator, engineId: string, recipe: (doc: Doc) => Result): Result {
  docOf(creator, engineId);
  let result: Result | undefined;
  creator.projects.endGroup();
  creator.projects.updateDoc<Doc>((doc) => {
    result = recipe(doc);
  });
  return result as Result;
}

/** Puts everything of `next` into `doc`, so a whole new document is still one edit. */
export function replaceDoc(doc: object, next: object) {
  for (const key of Object.keys(doc)) delete (doc as Record<string, unknown>)[key];
  Object.assign(doc, next);
}

/** The first line of a game's title. */
export function titleOf(engine: EngineModule, doc: unknown): string {
  return engine.gameTitle(doc).split('\n')[0]!.trim() || 'Untitled game';
}
