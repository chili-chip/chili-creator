import { ArrowDown, ArrowUp, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Input, Select, Textarea } from '../../../ui/input';
import { addDialogue, deleteDialogue, renameId } from '../edit';
import { eventParts, setInline } from '../events';
import { LIMITS, type Dialogue as DialogueType, type Game, type Line } from '../model';
import { useGame, useSelection } from '../state';
import { EventForm } from './event-form';
import { ErrorLine, IdField, useEdit } from './shared';

function LineCard({ game, dialogue, line, i, change }: {
  game: Game;
  dialogue: DialogueType;
  line: Line;
  i: number;
  change(recipe: (d: DialogueType) => void, group?: string): void;
}) {
  const n = `Line ${i + 1}`;
  const ids = dialogue.lines.flatMap((l) => (l.id ? [l.id] : []));
  const edit = (recipe: (l: Line) => void, group?: string) => change((d) => recipe(d.lines[i]!), group);
  const move = (by: number) =>
    change((d) => {
      const [moved] = d.lines.splice(i, 1);
      d.lines.splice(i + by, 0, moved!);
    });
  return (
    <li aria-label={n} className="space-y-2 rounded-md border border-line p-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-semibold">{n}</span>
        <Input
          aria-label={`${n} id`}
          placeholder="id, for jumps"
          className="w-28 font-mono"
          value={line.id ?? ''}
          onChange={(event) =>
            edit((l) => {
              const id = event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
              if (id) l.id = id;
              else delete l.id;
            }, `line-id-${i}`)
          }
        />
        <Input
          aria-label={`${n} speaker`}
          placeholder="speaker"
          list="rpg-speakers"
          className="w-28"
          value={line.who ?? ''}
          onChange={(event) =>
            edit((l) => {
              if (event.target.value) l.who = event.target.value.slice(0, 24);
              else delete l.who;
            }, `line-who-${i}`)
          }
        />
        <Button size="icon" variant="ghost" aria-label={`Move ${n.toLowerCase()} up`} disabled={i === 0} onClick={() => move(-1)}>
          <ArrowUp />
        </Button>
        <Button size="icon" variant="ghost" aria-label={`Move ${n.toLowerCase()} down`} disabled={i === dialogue.lines.length - 1} onClick={() => move(1)}>
          <ArrowDown />
        </Button>
        <Button size="icon" variant="ghost" aria-label={`Delete ${n.toLowerCase()}`} disabled={dialogue.lines.length <= 1} onClick={() => change((d) => void d.lines.splice(i, 1))}>
          <Trash2 />
        </Button>
      </div>
      <Textarea aria-label={`${n} text`} className="min-h-14 w-full font-sans" maxLength={400} value={line.text} onChange={(event) => edit((l) => void (l.text = event.target.value), `line-text-${i}`)} />
      <ol aria-label={`${n} choices`} className="space-y-1">
        {(line.choices ?? []).map((choice, c) => {
          const cn = `${n} choice ${c + 1}`;
          const setChoice = (recipe: (ch: NonNullable<Line['choices']>[number]) => void, group?: string) => edit((l) => recipe(l.choices![c]!), group);
          return (
            <li key={c} className="space-y-1 pl-3">
              <div className="flex flex-wrap items-center gap-1">
                ▸
                <Input aria-label={`${cn} text`} maxLength={20} className="w-32" value={choice.text} onChange={(event) => setChoice((ch) => void (ch.text = event.target.value), `choice-${i}-${c}`)} />
                <Select
                  aria-label={`${cn} goes to`}
                  value={choice.goto ?? ''}
                  onChange={(event) =>
                    setChoice((ch) => {
                      if (event.target.value) ch.goto = event.target.value;
                      else delete ch.goto;
                    })
                  }
                >
                  <option value="">ends the talk</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      goes to {id}
                    </option>
                  ))}
                  {choice.goto && !ids.includes(choice.goto) && <option value={choice.goto}>{choice.goto} (gone)</option>}
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${cn.toLowerCase()}`}
                  onClick={() =>
                    edit((l) => {
                      l.choices!.splice(c, 1);
                      if (!l.choices!.length) delete l.choices;
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <details>
                <summary className="cursor-pointer text-muted">What picking it does</summary>
                <EventForm game={game} label={cn} title="When picked" parts={eventParts(choice)} onChange={(parts) => setChoice((ch) => setInline(ch, parts))} />
              </details>
            </li>
          );
        })}
      </ol>
      {(line.choices?.length ?? 0) < LIMITS.choices && (
        <Button size="sm" variant="ghost" onClick={() => edit((l) => void (l.choices ??= []).push({ text: 'OK' }))}>
          <Plus /> Add choice to line {i + 1}
        </Button>
      )}
      <EventForm game={game} label={n} title="Show it only if, then do" parts={eventParts(line)} onChange={(parts) => edit((l) => setInline(l, parts))} />
    </li>
  );
}

function Dialogue() {
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<MessageSquare />}>Open a Chili RPG game to write what people say.</Empty>;
  const dialogue = selection.dialogue;
  const change = (recipe: (d: DialogueType) => void, group?: string) => void edit((g) => recipe(g.dialogue!.find((d) => d.id === dialogue!.id)!), group);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <datalist id="rpg-speakers">
        {(game.kinds ?? []).map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </datalist>
      <section className="flex flex-col gap-2 sm:w-40">
        <ul aria-label="Dialogues" className="flex flex-col gap-1">
          {(game.dialogue ?? []).map((d) => (
            <li key={d.id}>
              <Button size="sm" className="w-full justify-start" variant={d.id === dialogue?.id ? 'primary' : 'secondary'} aria-pressed={d.id === dialogue?.id} onClick={() => selection.set({ dialogue: d.id })}>
                {d.id}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={(game.dialogue?.length ?? 0) >= LIMITS.dialogue} onClick={() => edit((g) => selection.set({ dialogue: addDialogue(g).id }))}>
            <Plus /> Add dialogue
          </Button>
          {dialogue && (
            <Button size="sm" variant="ghost" aria-label={`Delete dialogue ${dialogue.id}`} onClick={() => edit((g) => deleteDialogue(g, dialogue.id))}>
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-muted">Give a dialogue to a character in Characters, or start it with a Say dialogue action.</p>
      </section>

      {dialogue ? (
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <IdField value={dialogue.id} onRename={(id) => edit((g) => renameId(g, 'dialogue', dialogue.id, id)) && selection.set({ dialogue: id })} />
            <label className="flex flex-col gap-1">
              Speaker
              <Input
                aria-label="Speaker"
                list="rpg-speakers"
                title="A character id shows its name and face. Other text shows as it is."
                value={dialogue.who ?? ''}
                onChange={(event) =>
                  change((d) => {
                    if (event.target.value) d.who = event.target.value.slice(0, 24);
                    else delete d.who;
                  }, `who-${dialogue.id}`)
                }
              />
            </label>
          </div>
          <p className="text-muted">Lines play in order. A line with conditions is skipped when they fail. A choice jumps to a line by its id, or ends the talk.</p>
          <ol aria-label="Lines" className="space-y-2">
            {dialogue.lines.map((line, i) => (
              <LineCard key={i} game={game} dialogue={dialogue} line={line} i={i} change={change} />
            ))}
          </ol>
          {dialogue.lines.length < LIMITS.lines && (
            <Button size="sm" onClick={() => change((d) => void d.lines.push({ text: '...' }))}>
              <Plus /> Add line
            </Button>
          )}
          <ErrorLine error={error} />
        </section>
      ) : (
        <p className="text-muted">Add a dialogue to start.</p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'rpg-dialogue',
  title: 'Dialogue',
  icon: MessageSquare,
  help: 'What people say: lines in order, lines that show only when the story is right, and choices that jump.',
  component: Dialogue,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
});
