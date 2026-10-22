import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  AVATAR,
  blipName,
  drawingName,
  roomName,
  tuneName,
  type ListKind,
  type ScriptNode,
  type World,
} from '../../bitsy';
import { Button } from '../../ui/button';
import { Input, Select, Textarea } from '../../ui/input';

// The dialog as blocks people can change: text, effects, choices and actions.
// Every change writes the whole script back with printScript.

type Node = ScriptNode;

export const listLabels: Record<ListKind, string> = {
  sequence: 'In order, then stays on the last',
  cycle: 'In order, then again from the top',
  shuffle: 'In any order',
};

const effectLabels: Record<string, string> = {
  wvy: 'Wavy',
  shk: 'Shaky',
  rbw: 'Rainbow',
  clr1: 'Colour 1',
  clr2: 'Colour 2',
  clr3: 'Colour 3',
};

export const transitionLabels: Record<string, string> = {
  '': 'None',
  fade_w: 'Fade to white',
  fade_b: 'Fade to black',
  wave: 'Wave',
  tunnel: 'Tunnel',
  slide_u: 'Slide up',
  slide_d: 'Slide down',
  slide_l: 'Slide left',
  slide_r: 'Slide right',
};

const quote = (text: string) => `"${text}"`;
const unquote = (text = '') => text.replace(/^"(.*)"$/, '$1');

/** The item most scripts mean: one called key, else the first. */
export const keyItem = (w: World) => (w.items.find((i) => /key/i.test(i.name ?? '')) ?? w.items[0])?.id ?? '0';
const firstVariable = (w: World) => w.variables[0]?.id ?? 'a';
const firstSprite = (w: World) => w.sprites.find((s) => s.id !== AVATAR)?.id ?? AVATAR;

const call = (name: string, ...args: string[]): Node => ({ type: 'call', name, args });
const text = (t: string): Node => ({ type: 'text', text: t });
const more = (w: World, sign: '+' | '-') => call('item', quote(keyItem(w)), `{{item ${quote(keyItem(w))}} ${sign} 1}`);

/** Everything the Add menu can make, grouped like the Bitsy editor's action builder. */
export const blockKinds: { group: string; kinds: { label: string; make(w: World): Node[] }[] }[] = [
  {
    group: 'Dialog',
    kinds: [
      { label: 'Text', make: () => [text('...')] },
      { label: 'New page', make: () => [call('pg')] },
      ...['wvy', 'shk', 'rbw', 'clr1', 'clr2', 'clr3'].map((name) => ({
        label: `${effectLabels[name]} text`,
        make: (): Node[] => [{ type: 'effect', name }, text('text'), { type: 'effect', name }],
      })),
      { label: 'Draw a tile', make: (w) => [call('drwt', quote(w.tiles[0]?.id ?? 'a'))] },
      { label: 'Draw a sprite', make: (w) => [call('drws', quote(firstSprite(w)))] },
      { label: 'Draw an item', make: (w) => [call('drwi', quote(w.items[0]?.id ?? '0'))] },
    ],
  },
  {
    group: 'Choices',
    kinds: [
      { label: 'Say lines in order', make: () => [{ type: 'list', kind: 'sequence', options: [[text('the first time')], [text('every time after')]] }] },
      { label: 'Say lines round and round', make: () => [{ type: 'list', kind: 'cycle', options: [[text('one')], [text('two')]] }] },
      { label: 'Say lines in any order', make: () => [{ type: 'list', kind: 'shuffle', options: [[text('one')], [text('two')]] }] },
      {
        label: 'If a variable is…',
        make: (w) => [{ type: 'branch', cases: [{ condition: `${firstVariable(w)} == 1`, body: [text('it is one')] }, { condition: 'else', body: [text('it is not')] }] }],
      },
      {
        label: 'If the player has an item',
        make: (w) => [
          {
            type: 'branch',
            cases: [
              { condition: `{item ${quote(keyItem(w))}} >= 1`, body: [text('you have it')] },
              { condition: 'else', body: [text('you do not have it')] },
            ],
          },
        ],
      },
    ],
  },
  {
    group: 'Exits and endings',
    kinds: [
      { label: 'Go to a room', make: (w) => [call('exit', quote(w.rooms[0]?.id ?? '0'), '8', '8')] },
      { label: 'End the game', make: () => [call('end')] },
      { label: 'Lock or unlock the exit', make: () => [call('property', 'locked', 'true')] },
    ],
  },
  {
    group: 'Room and sound',
    kinds: [
      { label: 'Change the palette', make: (w) => [call('pal', quote(w.palettes[0]?.id ?? '0'))] },
      { label: 'Change the avatar', make: (w) => [call('ava', quote(firstSprite(w)))] },
      { label: 'Play a blip', make: (w) => [call('blip', quote(w.blips[0]?.id ?? '1'))] },
      { label: 'Play a tune', make: (w) => [call('tune', quote(w.tunes[0]?.id ?? '1'))] },
    ],
  },
  {
    group: 'Items and variables',
    kinds: [
      { label: 'Set how many of an item', make: (w) => [call('item', quote(keyItem(w)), '10')] },
      { label: 'One more of an item', make: (w) => [more(w, '+')] },
      { label: 'One less of an item', make: (w) => [more(w, '-')] },
      { label: 'Show how many of an item', make: (w) => [call('say', `{item ${quote(keyItem(w))}}`)] },
      { label: 'Set a variable', make: (w) => [{ type: 'assign', variable: firstVariable(w), expression: '5' }] },
      { label: 'Change a variable', make: (w) => [{ type: 'assign', variable: firstVariable(w), expression: `${firstVariable(w)} + 1` }] },
      { label: 'Show a variable', make: (w) => [call('say', firstVariable(w))] },
    ],
  },
];

const allKinds = blockKinds.flatMap((g) => g.kinds);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted">
      {label}
      {children}
    </label>
  );
}

interface Choice {
  value: string;
  label: string;
}

function Pick({ label, value, choices, onChange }: { label: string; value: string; choices: Choice[]; onChange(value: string): void }) {
  const known = choices.some((c) => c.value === value);
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-7 max-w-40 py-0 text-xs">
      {!known && <option value={value}>{value}</option>}
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </Select>
  );
}

const small = 'h-7 py-0 text-xs';

/** A field that can be empty while typing; the script only takes what is not. */
function DraftInput({ value, onCommit, ...props }: { value: string; onCommit(value: string): void } & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft((current) => (current.trim() === value.trim() || !current.trim() ? current : value));
  }, [value]);
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onCommit(e.target.value);
      }}
    />
  );
}

function choicesFor(world: World, kind: 'room' | 'palette' | 'sprite' | 'tile' | 'item' | 'blip' | 'tune'): Choice[] {
  switch (kind) {
    case 'room':
      return world.rooms.map((r) => ({ value: r.id, label: roomName(r) }));
    case 'palette':
      return world.palettes.map((p) => ({ value: p.id, label: p.name || `palette ${p.id}` }));
    case 'sprite':
      return world.sprites.map((d) => ({ value: d.id, label: drawingName('sprites', d) }));
    case 'tile':
      return world.tiles.map((d) => ({ value: d.id, label: drawingName('tiles', d) }));
    case 'item':
      return world.items.map((d) => ({ value: d.id, label: drawingName('items', d) }));
    case 'blip':
      return world.blips.map((b) => ({ value: b.id, label: blipName(b) }));
    case 'tune':
      return world.tunes.map((t) => ({ value: t.id, label: tuneName(t) }));
  }
}

const quotedPicks: Record<string, { title: string; label: string; kind: Parameters<typeof choicesFor>[1] }> = {
  pal: { title: 'Change the palette', label: 'Palette', kind: 'palette' },
  ava: { title: 'Change the avatar', label: 'Sprite', kind: 'sprite' },
  blip: { title: 'Play a blip', label: 'Blip', kind: 'blip' },
  tune: { title: 'Play a tune', label: 'Tune', kind: 'tune' },
  drwt: { title: 'Draw a tile', label: 'Tile', kind: 'tile' },
  drws: { title: 'Draw a sprite', label: 'Sprite', kind: 'sprite' },
  drwi: { title: 'Draw an item', label: 'Item', kind: 'item' },
};

/** A block's title and the controls that change it. */
function Block({ node, world, onChange }: { node: Node; world: World; onChange(node: Node): void }): { title: string; body: ReactNode } {
  switch (node.type) {
    case 'text':
      return {
        title: 'Text',
        body: <Textarea aria-label="Text" value={node.text} rows={Math.min(6, node.text.split('\n').length)} className="min-h-0 w-full text-sm" onChange={(e) => onChange({ ...node, text: e.target.value })} />,
      };
    case 'effect':
      return {
        title: 'Text effect on or off',
        body: (
          <Pick
            label="Effect"
            value={node.name}
            choices={Object.entries(effectLabels).map(([value, label]) => ({ value, label }))}
            onChange={(name) => onChange({ ...node, name })}
          />
        ),
      };
    case 'assign':
      return {
        title: 'Set a variable',
        body: (
          <div className="flex flex-wrap items-center gap-2">
            <Pick
              label="Variable"
              value={node.variable}
              choices={world.variables.map((v) => ({ value: v.id, label: v.id }))}
              onChange={(variable) => onChange({ ...node, variable })}
            />
            <Field label="to">
              <Input aria-label="Value" value={node.expression} className={`${small} w-32`} onChange={(e) => onChange({ ...node, expression: e.target.value })} />
            </Field>
          </div>
        ),
      };
    case 'list':
      return {
        title: 'Choose a line',
        body: (
          <div className="space-y-2">
            <Pick
              label="Order"
              value={node.kind}
              choices={(Object.keys(listLabels) as ListKind[]).map((value) => ({ value, label: listLabels[value] }))}
              onChange={(kind) => onChange({ ...node, kind: kind as ListKind })}
            />
            <ol className="space-y-2">
              {node.options.map((option, n) => (
                <li key={n} className="border-l-2 border-line pl-2">
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-muted">
                    Option {n + 1}
                    <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Remove option" title="Remove option" onClick={() => onChange({ ...node, options: node.options.filter((_, i) => i !== n) })}>
                      <X />
                    </Button>
                  </div>
                  <BlockList
                    nodes={option}
                    world={world}
                    label={`Option ${n + 1}`}
                    onChange={(next) => onChange({ ...node, options: node.options.map((o, i) => (i === n ? next : o)) })}
                  />
                </li>
              ))}
            </ol>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...node, options: [...node.options, [text('...')]] })}>
              <Plus />
              Add option
            </Button>
          </div>
        ),
      };
    case 'branch': {
      const hasElse = node.cases.some((c) => c.condition === 'else');
      const setCases = (cases: typeof node.cases) => onChange({ ...node, cases });
      return {
        title: 'If…',
        body: (
          <div className="space-y-2">
            {node.cases.map((c, n) => (
              <div key={n} className="border-l-2 border-phosphor/50 pl-2">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-phosphor">
                  {c.condition === 'else' ? (
                    'Otherwise'
                  ) : c.condition === '' ? (
                    'Always'
                  ) : (
                    <Field label={n === 0 ? 'If' : 'Else if'}>
                      <DraftInput
                        aria-label="Condition"
                        value={c.condition}
                        className={`${small} w-44 font-mono`}
                        onCommit={(condition) => setCases(node.cases.map((x, i) => (i === n ? { ...x, condition } : x)))}
                      />
                    </Field>
                  )}
                  <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Remove case" title="Remove case" onClick={() => setCases(node.cases.filter((_, i) => i !== n))}>
                    <X />
                  </Button>
                </div>
                <BlockList nodes={c.body} world={world} label={c.condition === 'else' ? 'Otherwise' : `Case ${n + 1}`} onChange={(body) => setCases(node.cases.map((x, i) => (i === n ? { ...x, body } : x)))} />
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const added = { condition: `${firstVariable(world)} == 1`, body: [text('...')] };
                  const at = hasElse ? node.cases.findIndex((c) => c.condition === 'else') : node.cases.length;
                  setCases([...node.cases.slice(0, at), added, ...node.cases.slice(at)]);
                }}
              >
                <Plus />
                Add a condition
              </Button>
              {!hasElse && (
                <Button size="sm" variant="ghost" onClick={() => setCases([...node.cases, { condition: 'else', body: [text('...')] }])}>
                  <Plus />
                  Add otherwise
                </Button>
              )}
            </div>
          </div>
        ),
      };
    }
    case 'call':
      return CallBlock({ node, world, onChange });
  }
}

function CallBlock({ node, world, onChange }: { node: Extract<Node, { type: 'call' }>; world: World; onChange(node: Node): void }): { title: string; body: ReactNode } {
  const setArg = (index: number, value: string | undefined) => {
    const args = [...node.args];
    if (value === undefined) args.splice(index);
    else args[index] = value;
    onChange({ ...node, args });
  };
  const pick = quotedPicks[node.name];
  if (pick) {
    return {
      title: pick.title,
      body: <Pick label={pick.label} value={unquote(node.args[0])} choices={choicesFor(world, pick.kind)} onChange={(v) => setArg(0, quote(v))} />,
    };
  }
  switch (node.name) {
    case 'pg':
      return { title: 'New page', body: null };
    case 'br':
      return { title: 'New line', body: null };
    case 'end':
      return { title: 'End the game', body: null };
    case 'exit':
      return {
        title: 'Go to a room',
        body: (
          <div className="flex flex-wrap items-center gap-2">
            <Pick label="Room" value={unquote(node.args[0])} choices={choicesFor(world, 'room')} onChange={(v) => setArg(0, quote(v))} />
            {[1, 2].map((i) => (
              <Field key={i} label={i === 1 ? 'x' : 'y'}>
                <Input
                  type="number"
                  min={0}
                  max={15}
                  aria-label={i === 1 ? 'X' : 'Y'}
                  value={node.args[i] ?? '0'}
                  className={`${small} w-14`}
                  onChange={(e) => setArg(i, String(Math.max(0, Math.min(15, Number(e.target.value) || 0))))}
                />
              </Field>
            ))}
            <Pick
              label="Transition"
              value={unquote(node.args[3])}
              choices={Object.entries(transitionLabels).map(([value, label]) => ({ value, label }))}
              onChange={(v) => setArg(3, v ? quote(v) : undefined)}
            />
          </div>
        ),
      };
    case 'property':
      if (node.args[0] === 'locked') {
        return {
          title: 'Lock or unlock the exit',
          body: (
            <Pick
              label="Locked"
              value={node.args[1] ?? 'true'}
              choices={[
                { value: 'true', label: 'Locked' },
                { value: 'false', label: 'Unlocked' },
              ]}
              onChange={(v) => setArg(1, v)}
            />
          ),
        };
      }
      break;
    case 'item':
      if (node.args.length >= 2) {
        return {
          title: 'Set how many of an item',
          body: (
            <div className="flex flex-wrap items-center gap-2">
              <Pick label="Item" value={unquote(node.args[0])} choices={choicesFor(world, 'item')} onChange={(v) => setArg(0, quote(v))} />
              <Field label="to">
                <Input aria-label="Count" value={node.args.slice(1).join(' ')} className={`${small} w-40 font-mono`} onChange={(e) => setArg(1, e.target.value || '0')} />
              </Field>
            </div>
          ),
        };
      }
      break;
    case 'say':
    case 'print':
      return {
        title: 'Show a value',
        body: <Input aria-label="Expression" value={node.args.join(' ')} className={`${small} w-48 font-mono`} onChange={(e) => onChange({ ...node, args: [e.target.value || '""'] })} />,
      };
  }
  return {
    title: 'Code',
    body: (
      <Input
        aria-label="Code"
        value={[node.name, ...node.args].join(' ')}
        className={`${small} w-56 font-mono`}
        onChange={(e) => {
          const [name = node.name, ...args] = e.target.value.split(' ');
          onChange({ ...node, name, args });
        }}
      />
    ),
  };
}

/** Blank lines between blocks are kept but not shown. */
const shown = (node: Node) => node.type !== 'text' || node.text.trim() !== '';

export function BlockList({ nodes, world, label, onChange }: { nodes: Node[]; world: World; label?: string; onChange(nodes: Node[]): void }) {
  const visible = nodes.map((node, index) => ({ node, index })).filter(({ node }) => shown(node));

  function move(from: number, to: number) {
    const next = [...nodes];
    [next[from], next[to]] = [next[to]!, next[from]!];
    onChange(next);
  }

  function add(kindLabel: string) {
    const kind = allKinds.find((k) => k.label === kindLabel);
    if (!kind) return;
    const made = kind.make(world);
    // A new block starts on its own line.
    onChange(nodes.length ? [...nodes, text('\n'), ...made] : made);
  }

  return (
    <div className="space-y-1.5">
      <ul aria-label={label} className="space-y-1.5">
        {visible.map(({ node, index }, n) => {
          const { title, body } = Block({ node, world, onChange: (changed) => onChange(nodes.map((x, i) => (i === index ? changed : x))) });
          return (
            <li key={index} className="rounded-md border border-line bg-bg-0 p-1.5">
              <div className="mb-1 flex items-center gap-0.5 text-[11px] text-muted">
                <span className="mr-auto">{title}</span>
                <Button size="icon" variant="ghost" className="size-6" aria-label="Move up" title="Move up" disabled={n === 0} onClick={() => move(index, visible[n - 1]!.index)}>
                  <ArrowUp />
                </Button>
                <Button size="icon" variant="ghost" className="size-6" aria-label="Move down" title="Move down" disabled={n === visible.length - 1} onClick={() => move(index, visible[n + 1]!.index)}>
                  <ArrowDown />
                </Button>
                <Button size="icon" variant="ghost" className="size-6" aria-label="Remove block" title="Remove block" onClick={() => onChange(nodes.filter((_, i) => i !== index))}>
                  <X />
                </Button>
              </div>
              {body}
            </li>
          );
        })}
      </ul>
      <Select aria-label="Add a block" value="" onChange={(event) => add(event.target.value)} className="h-7 w-fit py-0 text-xs">
        <option value="">Add a block…</option>
        {blockKinds.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.kinds.map((k) => (
              <option key={k.label} value={k.label}>
                {k.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
