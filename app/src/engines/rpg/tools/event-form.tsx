// One form for every event in a Chili RPG game: conditions, actions, else.
import { Plus, Trash2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '../../../ui/button';
import { Input, Select } from '../../../ui/input';
import { whole } from '../edit';
import { ACTIONS, CONDITIONS, OPS, actionType, conditionType, knownFlags, knownVars, newAction, newCondition, type EventParts } from '../events';
import { SOUNDS, type Action, type Condition, type Game, type Op } from '../model';

type Row = Record<string, unknown>;

function Choose({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange(v: string): void }) {
  const known = options.some(([v]) => v === value);
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {!known && <option value={value}>{value} (gone)</option>}
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </Select>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(n: number): void }) {
  return <Input aria-label={label} type="number" min={min} max={max} className="w-16" value={value} onChange={(event) => onChange(whole(event.target.value, min, max))} />;
}

/** A flag or variable name: free text, with the ones the game already uses offered. */
function Name({ label, value, list, onChange }: { label: string; value: string; list: string; onChange(v: string): void }) {
  return (
    <Input
      aria-label={label}
      list={list}
      className="w-28"
      value={value}
      onChange={(event) => onChange(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24))}
    />
  );
}

function ops(label: string, row: Row, set: (patch: Row) => void) {
  return <Choose label={label} value={(row.op as string) ?? '='} options={OPS.map((o) => [o, o])} onChange={(op) => set({ op: op as Op })} />;
}

function lists(game: Game) {
  const named = <T extends { id: string; name?: string; title?: string }>(list: T[] | undefined): [string, string][] =>
    (list ?? []).map((x) => [x.id, x.name ?? x.title ?? x.id]);
  return {
    items: named(game.items),
    dialogue: named(game.dialogue),
    quests: named(game.quests),
    rooms: game.rooms.map((r): [string, string] => [r.id, r.name ?? r.id]),
    stats: game.stats.filter((s) => s.id !== 'hp').map((s): [string, string] => [s.id, s.label ?? s.id]),
    allStats: game.stats.map((s): [string, string] => [s.id, s.label ?? s.id]),
  };
}

function ActionFields({ game, action, n, ids, onChange }: { game: Game; action: Action; n: string; ids: { flags: string; vars: string }; onChange(a: Action): void }) {
  const row = action as Row;
  const l = lists(game);
  const set = (patch: Row) => onChange({ ...row, ...patch } as Action);
  switch (actionType(action)) {
    case 'say':
      return <Choose label={`${n} dialogue`} value={row.say as string} options={l.dialogue} onChange={(say) => set({ say })} />;
    case 'give':
    case 'take': {
      const key = 'give' in row ? 'give' : 'take';
      return (
        <>
          <Choose label={`${n} item`} value={row[key] as string} options={l.items} onChange={(v) => set({ [key]: v })} />
          <Num label={`${n} how many`} value={(row.count as number) ?? 1} min={1} max={999} onChange={(count) => set({ count: count > 1 ? count : undefined })} />
        </>
      );
    }
    case 'set':
      return <Name label={`${n} flag`} value={row.set as string} list={ids.flags} onChange={(v) => set({ set: v })} />;
    case 'clear':
      return <Name label={`${n} flag`} value={row.clear as string} list={ids.flags} onChange={(v) => set({ clear: v })} />;
    case 'add':
      return (
        <>
          <Name label={`${n} variable`} value={row.add as string} list={ids.vars} onChange={(v) => set({ add: v })} />
          <Num label={`${n} amount`} value={row.value as number} min={-9999} max={9999} onChange={(value) => set({ value })} />
        </>
      );
    case 'quest':
      return (
        <>
          <Choose label={`${n} quest`} value={row.quest as string} options={l.quests} onChange={(quest) => set({ quest })} />
          <Choose
            label={`${n} quest stage`}
            value={row.done ? 'done' : String(row.stage ?? 1)}
            options={[...Array.from({ length: 8 }, (_, i): [string, string] => [String(i + 1), `stage ${i + 1}`]), ['done', 'done']]}
            onChange={(v) => onChange((v === 'done' ? { quest: row.quest, done: true } : { quest: row.quest, stage: Number(v) }) as Action)}
          />
        </>
      );
    case 'heal':
    case 'hurt':
    case 'xp': {
      const key = actionType(action);
      return <Num label={`${n} amount`} value={row[key] as number} min={0} max={9999} onChange={(v) => set({ [key]: v })} />;
    }
    case 'stat':
      return (
        <>
          <Choose label={`${n} stat`} value={row.stat as string} options={l.stats} onChange={(stat) => set({ stat })} />
          <Num label={`${n} amount`} value={row.value as number} min={-9999} max={9999} onChange={(value) => set({ value })} />
        </>
      );
    case 'warp':
      return (
        <>
          <Choose label={`${n} room`} value={row.warp as string} options={l.rooms} onChange={(warp) => set({ warp })} />
          <Num label={`${n} x`} value={row.x as number} min={0} max={63} onChange={(x) => set({ x })} />
          <Num label={`${n} y`} value={row.y as number} min={0} max={63} onChange={(y) => set({ y })} />
        </>
      );
    case 'sound':
      return <Choose label={`${n} sound`} value={row.sound as string} options={SOUNDS.map((s) => [s, s])} onChange={(sound) => set({ sound })} />;
    case 'end':
      return <Choose label={`${n} ending`} value={row.end as string} options={[['win', 'won'], ['lose', 'lost']]} onChange={(end) => set({ end })} />;
    case 'music':
      return <span className="text-muted">plays {String(row.music)}</span>;
    case 'call':
      return <span className="text-muted">runs {String(row.call)} (C++ only)</span>;
    default:
      return null;
  }
}

function ConditionFields({ game, condition, n, ids, onChange }: { game: Game; condition: Condition; n: string; ids: { flags: string; vars: string }; onChange(c: Condition): void }) {
  const row = condition as Row;
  const l = lists(game);
  const set = (patch: Row) => onChange({ ...row, ...patch } as Condition);
  switch (conditionType(condition)) {
    case 'flag':
      return <Name label={`${n} flag`} value={row.flag as string} list={ids.flags} onChange={(flag) => set({ flag })} />;
    case 'not':
      return <Name label={`${n} flag`} value={row.not as string} list={ids.flags} onChange={(v) => set({ not: v })} />;
    case 'has':
      return (
        <>
          <Choose label={`${n} item`} value={row.has as string} options={l.items} onChange={(has) => set({ has })} />
          <Num label={`${n} at least`} value={(row.count as number) ?? 1} min={1} max={999} onChange={(count) => set({ count: count > 1 ? count : undefined })} />
        </>
      );
    case 'quest':
      return (
        <>
          <Choose label={`${n} quest`} value={row.quest as string} options={l.quests} onChange={(quest) => set({ quest })} />
          <Choose
            label={`${n} quest is`}
            value={row.done !== undefined ? (row.done ? 'done' : 'not-done') : `${(row.op as string) ?? '='}${row.stage ?? 0}`}
            options={[
              ['=0', 'not started'],
              ...Array.from({ length: 8 }, (_, i): [string, string] => [`=${i + 1}`, `at stage ${i + 1}`]),
              ...Array.from({ length: 8 }, (_, i): [string, string] => [`>=${i + 1}`, `at stage ${i + 1} or later`]),
              ['done', 'done'],
              ['not-done', 'not done'],
            ]}
            onChange={(v) => {
              if (v === 'done' || v === 'not-done') onChange({ quest: row.quest as string, done: v === 'done' });
              else {
                const [, op, stage] = /^(>=|=)(\d)$/.exec(v)!;
                onChange({ quest: row.quest as string, stage: Number(stage), ...(op === '=' ? {} : { op: op as Op }) });
              }
            }}
          />
        </>
      );
    case 'var':
      return (
        <>
          <Name label={`${n} variable`} value={row.var as string} list={ids.vars} onChange={(v) => set({ var: v })} />
          {ops(`${n} compare`, row, set)}
          <Num label={`${n} value`} value={(row.value as number) ?? 0} min={-32768} max={32767} onChange={(value) => set({ value })} />
        </>
      );
    case 'stat':
      return (
        <>
          <Choose label={`${n} stat`} value={row.stat as string} options={l.allStats} onChange={(stat) => set({ stat })} />
          {ops(`${n} compare`, row, set)}
          <Num label={`${n} value`} value={(row.value as number) ?? 0} min={-9999} max={9999} onChange={(value) => set({ value })} />
        </>
      );
  }
}

/** Drops undefined fields, so a count of 1 leaves the file. */
function clean<T>(value: T): T {
  return Object.fromEntries(Object.entries(value as Row).filter(([, v]) => v !== undefined)) as T;
}

function Rows<T>({ title, label, items, render, onChange, make, add }: {
  title: string;
  label: string;
  items: T[];
  render(item: T, n: string, set: (next: T) => void): ReactNode;
  onChange(items: T[]): void;
  make(): T;
  add: string;
}) {
  return (
    <div className="space-y-1">
      {items.length > 0 && <p className="text-muted">{title}</p>}
      <ol aria-label={label} className="space-y-1">
        {items.map((item, i) => {
          const n = `${label} ${i + 1}`;
          return (
            <li key={i} aria-label={n} className="flex flex-wrap items-center gap-1">
              {render(item, n, (next) => onChange(items.map((x, j) => (j === i ? clean(next) : x))))}
              <Button size="icon" variant="ghost" aria-label={`Delete ${n.toLowerCase()}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ol>
      <Button size="sm" variant="ghost" onClick={() => onChange([...items, make()])}>
        <Plus /> {add}
      </Button>
    </div>
  );
}

/**
 * Conditions, actions and else actions as rows. `label` names the event for
 * screen readers and tests ("Bump", "Line 2").
 */
export function EventForm({ game, label, title = label, parts, onChange }: {
  game: Game;
  label: string;
  /** What the box shows as its heading, when it is not the label. */
  title?: string;
  parts: EventParts;
  onChange(parts: EventParts): void;
}) {
  const uid = useId();
  const ids = { flags: `${uid}-flags`, vars: `${uid}-vars` };
  const action = (a: Action, n: string, set: (next: Action) => void) => (
    <>
      <Choose
        label={`${n} type`}
        value={actionType(a)}
        options={ACTIONS.map(([v, t]) => [v, t]) as [string, string][]}
        onChange={(type) => set(newAction(type as (typeof ACTIONS)[number][0], game))}
      />
      <ActionFields game={game} action={a} n={n} ids={ids} onChange={set} />
    </>
  );
  return (
    <fieldset aria-label={label} className="space-y-2 rounded-md border border-line p-2">
      <legend className="px-1 font-semibold">{title}</legend>
      <datalist id={ids.flags}>
        {knownFlags(game).map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <datalist id={ids.vars}>
        {knownVars(game).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <Rows<Condition>
          title="If all of these are true"
          label={`${label} condition`}
          items={parts.if}
          add="Add condition"
          make={() => newCondition('flag', game)}
          onChange={(c) => onChange({ ...parts, if: c, else: c.length ? parts.else : [] })}
          render={(c, n, set) => (
            <>
              <Choose label={`${n} type`} value={conditionType(c)} options={CONDITIONS.map(([v, t]) => [v, t]) as [string, string][]} onChange={(type) => set(newCondition(type as never, game))} />
              <ConditionFields game={game} condition={c} n={n} ids={ids} onChange={set} />
            </>
          )}
        />
      <Rows<Action>
        title={parts.if.length ? 'Then do' : 'Do'}
        label={`${label} action`}
        items={parts.do}
        add="Add action"
        make={() => newAction(game.dialogue?.length ? 'say' : 'set', game)}
        onChange={(d) => onChange({ ...parts, do: d })}
        render={action}
      />
      {parts.if.length > 0 && (
        <Rows<Action>
          title="Otherwise do"
          label={`${label} else action`}
          items={parts.else}
          add="Add else action"
          make={() => newAction(game.dialogue?.length ? 'say' : 'set', game)}
          onChange={(e) => onChange({ ...parts, else: e })}
          render={action}
        />
      )}
    </fieldset>
  );
}
