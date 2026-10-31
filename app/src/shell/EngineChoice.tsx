import { MAX_GAMES } from '../chili-api';
import { Button } from '../ui/button';
import { useCreator, useProjects } from './creator-context';

/** The first screen: one card per editor. Picking one opens it. */
export function EngineChoice() {
  const creator = useCreator();
  const state = useProjects();
  const atLimit = state.mode === 'platform' && creator.projects.gamesUsed() >= MAX_GAMES;

  return (
    <section aria-labelledby="engine-choice" className="h-full overflow-auto p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 id="engine-choice" className="font-display text-2xl font-bold">
            Pick an editor
          </h1>
          <p className="text-sm text-muted">Each editor makes one kind of game and keeps its own list of games.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {creator.engines.offered().map((engine) => {
            const Icon = engine.icon;
            const games = creator.projects.projectsOf(engine.id).length;
            return (
              <li key={engine.id} className="rounded-lg border border-line bg-bg-2 has-[>button:hover]:border-chili/60">
                <button
                  type="button"
                  onClick={() => void creator.projects.chooseEngine(engine.id)}
                  className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-phosphor"
                >
                  <Icon className="mt-0.5 size-6 shrink-0 text-chili" aria-hidden />
                  <span>
                    <span className="block text-base font-medium">{engine.title}</span>
                    <span className="block text-sm text-muted">{engine.description}</span>
                    {state.list.status === 'ready' && (
                      <span className="mt-1 block text-xs text-muted">
                        {games === 1 ? '1 project' : `${games} projects`}
                      </span>
                    )}
                  </span>
                </button>
                {engine.templates && (
                  <div className="flex flex-wrap items-center gap-1 px-4 pb-4 text-xs text-muted">
                    Start from
                    {engine.templates.map((template) => (
                      <Button
                        key={template.title}
                        size="sm"
                        variant="ghost"
                        disabled={atLimit || state.mode === 'unknown'}
                        onClick={async () => {
                          await creator.projects.chooseEngine(engine.id);
                          await creator.projects.create(template.title, template.make(template.title), engine.id);
                        }}
                      >
                        {template.title}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
