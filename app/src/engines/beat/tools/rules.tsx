import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/cn';
import { Input, Select } from '../../../ui/input';
import { addRule, defaultAction, defaultTrigger, moveRule } from '../edit';
import { LIMITS, type Action, type Condition, type Game, type Rule } from '../model';
import { useGame, useSelection, useUpdate } from '../state';
import { ThingImage } from './things';

type Fields = Record<string, unknown>;

const TRIGGERS = [
  ['press', 'you press'],
  ['bump', 'bumps'],
  ['every', 'every few beats'],
  ['start', 'the screen starts'],
  ['counter', 'a counter reaches'],
] as const;

const ACTIONS = [
  ['move', 'move'],
  ['turn', 'turn'],
  ['become', 'become'],
  ['vanish', 'vanish'],
  ['make', 'make'],
  ['count', 'count'],
  ['say', 'say'],
  ['sound', 'play sound'],
  ['go', 'go to screen'],
  ['shake', 'shake'],
  ['win', 'win'],
  ['lose', 'lose'],
] as const;

const BUTTONS = [
  ['arrow', 'an arrow'],
  ['a', 'A'],
  ['b', 'B'],
  ['up', 'up'],
  ['down', 'down'],
  ['left', 'left'],
  ['right', 'right'],
] as const;

const WAYS = [
  ['same', 'that way'],
  ['forward', 'forward'],
  ['back', 'back'],
  ['up', 'up'],
  ['down', 'down'],
  ['left', 'left'],
  ['right', 'right'],
  ['toward', 'toward you'],
  ['away', 'away from you'],
  ['random', 'at random'],
] as const;

/** The kind of a trigger or action: its first field. */
const kindOf = (fields: object) => Object.keys(fields).find((k) => k !== 'who' && k !== 'to' && k !== 'thing' && k !== 'reaches' && k !== 'add' && k !== 'set')!;

function Choice({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-7">
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </Select>
  );
}

/** A thing, by picture and name; `extra` adds "you" and "anything". */
function ThingChoice({ game, label, value, extra = [], onChange }: { game: Game; label: string; value: string; extra?: ('you' | 'any')[]; onChange(value: string): void }) {
  const thing = game.things.find((t) => t.key === value);
  return (
    <span className="inline-flex items-center gap-1">
      {thing && <ThingImage game={game} thing={thing} className="size-5" />}
      <Choice
        label={label}
        value={value}
        options={[
          ...extra.map((e) => [e, e === 'you' ? 'you' : 'anything'] as const),
          ...game.things.map((t) => [t.key, t.name] as const),
          ...(thing || extra.includes(value as 'you') || value === 'any' ? [] : [[value, `missing (${value})`] as const]),
        ]}
        onChange={onChange}
      />
    </span>
  );
}

function Count({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return (
    <Input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      value={value}
      className="h-7 w-16"
      onChange={(event) => {
        const n = Math.round(Number(event.target.value));
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

function CounterChoice({ game, label, value, onChange }: { game: Game; label: string; value: string; onChange(value: string): void }) {
  const counters = game.counters ?? [];
  return <Choice label={label} value={value} options={counters.length ? counters.map((c) => [c.id, c.name] as const) : [['', 'no counters yet']]} onChange={onChange} />;
}

function TriggerEditor({ game, when, onChange }: { game: Game; when: Fields; onChange(next: Fields): void }) {
  const kind = kindOf(when);
  const set = (patch: Fields) => onChange({ ...when, ...patch });
  let detail: ReactNode = null;
  if (kind === 'press') detail = <Choice label="Button" value={when.press as string} options={BUTTONS} onChange={(press) => set({ press })} />;
  if (kind === 'bump') {
    const [a, b] = when.bump as [string, string];
    detail = (
      <>
        <ThingChoice game={game} label="Bumper" value={a} extra={['you', 'any']} onChange={(v) => set({ bump: [v, b] })} />
        <span>bumps</span>
        <ThingChoice game={game} label="Bumped" value={b} extra={['you', 'any']} onChange={(v) => set({ bump: [a, v] })} />
      </>
    );
  }
  if (kind === 'every') {
    detail = (
      <>
        <Count label="Beats" value={when.every as number} min={1} max={64} onChange={(every) => set({ every })} />
        <span>beats,</span>
        <ThingChoice game={game} label="Thing" value={when.thing as string} extra={['you']} onChange={(thing) => set({ thing })} />
      </>
    );
  }
  if (kind === 'counter') {
    detail = (
      <>
        <CounterChoice game={game} label="Counter" value={when.counter as string} onChange={(counter) => set({ counter })} />
        <span>reaches</span>
        <Count label="Value" value={when.reaches as number} min={0} max={999} onChange={(reaches) => set({ reaches })} />
      </>
    );
  }
  return (
    <>
      <Choice
        label="Trigger"
        value={kind === 'bump' ? 'bump' : kind}
        options={TRIGGERS}
        onChange={(next) => onChange(defaultTrigger(next, game) as Fields)}
      />
      {detail}
    </>
  );
}

function ConditionEditor({ game, condition, onChange }: { game: Game; condition: Fields; onChange(next: Fields): void }) {
  if ('chance' in condition) {
    return (
      <>
        <span>1 in</span>
        <Count label="Chance" value={condition.chance as number} min={2} max={64} onChange={(chance) => onChange({ chance })} />
        <span>chance</span>
      </>
    );
  }
  const op = ['atLeast', 'atMost', 'exactly'].find((k) => k in condition)!;
  return (
    <>
      <CounterChoice game={game} label="Counter" value={condition.counter as string} onChange={(counter) => onChange({ ...condition, counter })} />
      <Choice
        label="Compare"
        value={op}
        options={[
          ['atLeast', 'is at least'],
          ['atMost', 'is at most'],
          ['exactly', 'is exactly'],
        ]}
        onChange={(next) => onChange({ counter: condition.counter, [next]: condition[op] })}
      />
      <Count label="Value" value={condition[op] as number} min={0} max={999} onChange={(n) => onChange({ ...condition, [op]: n })} />
    </>
  );
}

function ActionEditor({ game, trigger, action, onChange }: { game: Game; trigger: string; action: Fields; onChange(next: Fields): void }) {
  const kind = kindOf(action);
  const set = (patch: Fields) => onChange({ ...action, ...patch });
  const whoOptions = [
    ['', trigger === 'every' ? 'it' : trigger === 'bump' ? 'the bumper' : 'you'],
    ['you', 'you'],
    ...(trigger === 'every' ? [['it', 'it']] : []),
    ...(trigger === 'bump' ? [['bumper', 'the bumper'], ['bumped', 'the bumped']] : []),
  ] as [string, string][];
  const who = ['move', 'turn', 'become', 'vanish', 'make'].includes(kind) ? (
    <Choice
      label="Who"
      value={(action.who as string) ?? ''}
      options={whoOptions}
      onChange={(value) => {
        const next = { ...action };
        if (value) next.who = value;
        else delete next.who;
        onChange(next);
      }}
    />
  ) : null;
  let detail: ReactNode = null;
  if (kind === 'move' || kind === 'turn') detail = <Choice label="Way" value={action[kind] as string} options={WAYS} onChange={(v) => set({ [kind]: v })} />;
  if (kind === 'become') detail = <ThingChoice game={game} label="Becomes" value={action.become as string} onChange={(become) => set({ become })} />;
  if (kind === 'make') {
    detail = (
      <>
        <ThingChoice game={game} label="Makes" value={action.make as string} onChange={(make) => set({ make })} />
        <Choice label="Where" value={action.to as string} options={WAYS} onChange={(to) => set({ to })} />
      </>
    );
  }
  if (kind === 'count') {
    const setting = 'set' in action;
    detail = (
      <>
        <CounterChoice game={game} label="Counter" value={action.count as string} onChange={(count) => set({ count })} />
        <Choice
          label="Change"
          value={setting ? 'set' : 'add'}
          options={[
            ['add', 'goes up or down by'],
            ['set', 'is set to'],
          ]}
          onChange={(next) => onChange({ count: action.count, [next]: next === 'set' ? 0 : 1 })}
        />
        <Count
          label="Amount"
          value={(setting ? action.set : action.add) as number}
          min={setting ? 0 : -999}
          max={999}
          onChange={(n) => set({ [setting ? 'set' : 'add']: n })}
        />
      </>
    );
  }
  if (kind === 'say' || kind === 'win' || kind === 'lose') {
    detail = (
      <Input aria-label="Text" value={action[kind] as string} maxLength={64} className="h-7 min-w-40 flex-1" onChange={(event) => set({ [kind]: event.target.value })} />
    );
  }
  if (kind === 'sound') {
    const blips = game.blips ?? [];
    detail = <Choice label="Sound" value={action.sound as string} options={blips.length ? blips.map((b) => [b.id, b.id] as const) : [['', 'no sounds yet']]} onChange={(sound) => set({ sound })} />;
  }
  if (kind === 'go') detail = <Choice label="Screen" value={action.go as string} options={game.screens.map((s) => [s.id, s.id] as const)} onChange={(go) => set({ go })} />;
  return (
    <>
      {who}
      <Choice label="Action" value={kind} options={ACTIONS} onChange={(next) => onChange(defaultAction(next, game) as Fields)} />
      {detail}
    </>
  );
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return <b className={cn('rounded px-1.5 py-0.5 text-[10px] tracking-wider text-white', className)}>{children}</b>;
}

function RuleCard({ game, rule, index, lit, onChange, onMove, onDelete }: { game: Game; rule: Rule; index: number; lit: boolean; onChange(rule: Rule): void; onMove(by: number): void; onDelete(): void }) {
  const trigger = kindOf(rule.when);
  const conditions = rule.if ?? [];
  const setCondition = (i: number, next: Fields | null) => {
    const list = [...conditions] as Fields[];
    if (next) list[i] = next;
    else list.splice(i, 1);
    const copy: Rule = { ...rule, if: list as unknown as Condition[] };
    if (!list.length) delete copy.if;
    onChange(copy);
  };
  const setAction = (i: number, next: Fields | null) => {
    const list = [...rule.do] as Fields[];
    if (next) list[i] = next;
    else list.splice(i, 1);
    onChange({ ...rule, do: list as unknown as Action[] });
  };
  return (
    <li
      aria-label={`Rule ${index + 1}`}
      data-lit={lit || undefined}
      className="space-y-1.5 rounded-lg border border-line bg-bg-2 p-2 transition-colors data-[lit]:border-phosphor data-[lit]:bg-phosphor/10"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-5 text-muted">{index + 1}</span>
        <Tag className="bg-[#3b5dc9]">WHEN</Tag>
        <TriggerEditor game={game} when={rule.when as Fields} onChange={(when) => onChange({ ...rule, when: when as Rule['when'] })} />
        <span className="ml-auto flex">
          <Button size="icon" variant="ghost" className="size-7" aria-label={`Move rule ${index + 1} up`} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" aria-label={`Move rule ${index + 1} down`} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" aria-label={`Delete rule ${index + 1}`} onClick={onDelete}>
            <Trash2 />
          </Button>
        </span>
      </div>
      {conditions.map((condition, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 pl-6">
          <Tag className="bg-[#5d275d]">IF</Tag>
          <ConditionEditor game={game} condition={condition as Fields} onChange={(next) => setCondition(i, next)} />
          <Button size="icon" variant="ghost" className="size-7" aria-label="Remove condition" onClick={() => setCondition(i, null)}>
            <X />
          </Button>
        </div>
      ))}
      {rule.do.map((action, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 pl-6">
          <Tag className="bg-[#257179]">{i === 0 ? 'THEN' : 'AND'}</Tag>
          <ActionEditor game={game} trigger={trigger} action={action as Fields} onChange={(next) => setAction(i, next)} />
          {rule.do.length > 1 && (
            <Button size="icon" variant="ghost" className="size-7" aria-label="Remove action" onClick={() => setAction(i, null)}>
              <X />
            </Button>
          )}
        </div>
      ))}
      <div className="flex gap-1 pl-6">
        {conditions.length < LIMITS.conditions && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setCondition(conditions.length, { chance: 2 })}>
              <Plus /> If chance
            </Button>
            {(game.counters ?? []).length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setCondition(conditions.length, { counter: game.counters![0]!.id, atLeast: 1 })}>
                <Plus /> If counter
              </Button>
            )}
          </>
        )}
        {rule.do.length < LIMITS.actions && (
          <Button size="sm" variant="ghost" onClick={() => setAction(rule.do.length, { move: 'same' })}>
            <Plus /> Action
          </Button>
        )}
      </div>
    </li>
  );
}

function Rules() {
  const game = useGame();
  const update = useUpdate();
  const selection = useSelection(game);
  const [error, setError] = useState('');
  if (!game) return <Empty icon={<ListChecks />}>Open a Chili Beat game to write its rules.</Empty>;

  function edit(recipe: (game: Game) => void) {
    setError('');
    try {
      update(recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="h-full overflow-auto p-3 text-xs">
      <p className="mb-2 text-muted">Every rule that matches runs, from top to bottom. While you play, the rules that just ran light up.</p>
      <ol aria-label="Rules" className="space-y-2">
        {game.rules.map((rule, i) => (
          <RuleCard
            key={i}
            game={game}
            rule={rule}
            index={i}
            lit={selection.lit.includes(i)}
            onChange={(next) => edit((g) => void (g.rules[i] = next))}
            onMove={(by) => edit((g) => moveRule(g, i, by))}
            onDelete={() => edit((g) => void g.rules.splice(i, 1))}
          />
        ))}
      </ol>
      <Button size="sm" className="mt-2" onClick={() => edit((g) => addRule(g))}>
        <Plus /> Add rule
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-chili">
          {error}
        </p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'beat-rules',
  title: 'Rules',
  icon: ListChecks,
  help: 'Rules are cards: When something happens, If something is true, Then do something. They decide everything in a Chili Beat game.',
  component: Rules,
  defaultPosition: 'within',
  defaultReference: 'beat-things',
  openByDefault: true,
});
