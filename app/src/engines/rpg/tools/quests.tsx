import { Plus, ScrollText, Trash2 } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Input, Select } from '../../../ui/input';
import { addQuest, deleteQuest, renameId, whole } from '../edit';
import { eventFrom, eventParts, knownFlags } from '../events';
import { LIMITS, type Game, type Goal, type Quest } from '../model';
import { useGame, useSelection } from '../state';
import { EventForm } from './event-form';
import { ErrorLine, IdField, useEdit } from './shared';

const GOALS = [
  ['', 'No goal: an event moves it on'],
  ['talk', 'Talk to'],
  ['collect', 'Have the item'],
  ['defeat', 'Beat'],
  ['reach', 'Reach a place'],
  ['flag', 'Flag is on'],
] as const;

function goalType(goal: Goal | undefined): string {
  return (['talk', 'collect', 'defeat', 'reach', 'flag'] as const).find((key) => goal?.[key] !== undefined) ?? '';
}

function newGoal(type: string, game: Game): Goal | undefined {
  const kind = game.kinds?.[0]?.id ?? 'character';
  switch (type) {
    case 'talk': return { talk: kind };
    case 'collect': return { collect: game.items?.[0]?.id ?? 'item' };
    case 'defeat': return { defeat: kind };
    case 'reach': return { reach: game.start.room, x: game.start.x, y: game.start.y };
    case 'flag': return { flag: knownFlags(game)[0] ?? 'flag' };
    default: return undefined;
  }
}

function GoalFields({ game, goal, n, onChange }: { game: Game; goal: Goal; n: string; onChange(goal: Goal): void }) {
  const select = (key: keyof Goal, options: { id: string; name?: string }[]) => (
    <Select aria-label={`${n} target`} value={String(goal[key])} onChange={(event) => onChange({ ...goal, [key]: event.target.value })}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name ?? o.id}
        </option>
      ))}
    </Select>
  );
  const count = (
    <Input
      aria-label={`${n} count`}
      type="number"
      min={1}
      max={999}
      className="w-16"
      value={goal.count ?? 1}
      onChange={(event) => {
        const c = whole(event.target.value, 1, 999);
        const next: Goal = { ...goal, count: c };
        if (c === 1) delete next.count;
        onChange(next);
      }}
    />
  );
  switch (goalType(goal)) {
    case 'talk':
      return select('talk', game.kinds ?? []);
    case 'collect':
      return <>{select('collect', game.items ?? [])}{count}</>;
    case 'defeat':
      return <>{select('defeat', game.kinds ?? [])}{count}</>;
    case 'reach':
      return (
        <>
          {select('reach', game.rooms)}
          {(['x', 'y'] as const).map((axis) => (
            <Input key={axis} aria-label={`${n} ${axis}`} type="number" min={0} max={63} className="w-16" value={goal[axis] ?? 0} onChange={(event) => onChange({ ...goal, [axis]: whole(event.target.value, 0, 63) })} />
          ))}
        </>
      );
    case 'flag':
      return (
        <Input
          aria-label={`${n} flag`}
          className="w-28"
          value={goal.flag ?? ''}
          onChange={(event) => onChange({ flag: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) })}
        />
      );
    default:
      return null;
  }
}

function Quests() {
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<ScrollText />}>Open a Chili RPG game to write its quests.</Empty>;
  const quest = selection.quest;
  const change = (recipe: (q: Quest) => void, group?: string) => void edit((g) => recipe(g.quests!.find((q) => q.id === quest!.id)!), group);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-2 sm:w-40">
        <ul aria-label="Quests" className="flex flex-col gap-1">
          {(game.quests ?? []).map((q) => (
            <li key={q.id}>
              <Button size="sm" className="w-full justify-start" variant={q.id === quest?.id ? 'primary' : 'secondary'} aria-pressed={q.id === quest?.id} onClick={() => selection.set({ quest: q.id })}>
                {q.title || q.id}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={(game.quests?.length ?? 0) >= LIMITS.quests} onClick={() => edit((g) => selection.set({ quest: addQuest(g).id }))}>
            <Plus /> Add quest
          </Button>
          {quest && (
            <Button size="sm" variant="ghost" aria-label={`Delete quest ${quest.id}`} onClick={() => edit((g) => deleteQuest(g, quest.id))}>
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-muted">Start a quest with a Set quest action, for example from a dialogue choice.</p>
      </section>

      {quest ? (
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <IdField value={quest.id} onRename={(id) => edit((g) => renameId(g, 'quest', quest.id, id)) && selection.set({ quest: id })} />
            <label className="flex flex-col gap-1">
              Title
              <Input
                aria-label="Title"
                maxLength={20}
                value={quest.title ?? ''}
                onChange={(event) =>
                  change((q) => {
                    if (event.target.value) q.title = event.target.value;
                    else delete q.title;
                  }, `title-${quest.id}`)
                }
              />
            </label>
          </div>
          <ol aria-label="Stages" className="space-y-2">
            {quest.stages.map((stage, i) => {
              const n = `Stage ${i + 1}`;
              const setStage = (recipe: (s: Quest['stages'][number]) => void, group?: string) => change((q) => recipe(q.stages[i]!), group);
              return (
                <li key={i} aria-label={n} className="space-y-2 rounded-md border border-line p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{n}</span>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${n.toLowerCase()}`} disabled={quest.stages.length <= 1} onClick={() => change((q) => void q.stages.splice(i, 1))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <Input
                    aria-label={`${n} log`}
                    placeholder="What the quest log says"
                    maxLength={120}
                    className="w-full"
                    value={stage.log ?? ''}
                    onChange={(event) =>
                      setStage((s) => {
                        if (event.target.value) s.log = event.target.value;
                        else delete s.log;
                      }, `log-${quest.id}-${i}`)
                    }
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <Select
                      aria-label={`${n} goal`}
                      value={goalType(stage.goal)}
                      onChange={(event) =>
                        setStage((s) => {
                          const goal = newGoal(event.target.value, game);
                          if (goal) s.goal = goal;
                          else delete s.goal;
                        })
                      }
                    >
                      {GOALS.map(([id, text]) => (
                        <option key={id} value={id}>
                          {text}
                        </option>
                      ))}
                    </Select>
                    {stage.goal && <GoalFields game={game} goal={stage.goal} n={`${n} goal`} onChange={(goal) => setStage((s) => void (s.goal = goal), `goal-${quest.id}-${i}`)} />}
                  </div>
                  <EventForm
                    game={game}
                    label={`When stage ${i + 1} is done`}
                    parts={eventParts(stage.done)}
                    onChange={(parts) =>
                      setStage((s) => {
                        const done = eventFrom(parts);
                        if (done) s.done = done;
                        else delete s.done;
                      })
                    }
                  />
                </li>
              );
            })}
          </ol>
          {quest.stages.length < LIMITS.stages && (
            <Button size="sm" onClick={() => change((q) => void q.stages.push({ log: 'What to do next.' }))}>
              <Plus /> Add stage
            </Button>
          )}
          <p className="text-muted">When a stage's goal is met, its done event runs and the next stage starts. After the last stage the quest is done.</p>
          <ErrorLine error={error} />
        </section>
      ) : (
        <p className="text-muted">Add a quest to start.</p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'rpg-quests',
  title: 'Quests',
  icon: ScrollText,
  help: 'Quests in stages: a log line, a goal (talk, have an item, beat enemies, reach a place) and what happens when it is met.',
  component: Quests,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
});
