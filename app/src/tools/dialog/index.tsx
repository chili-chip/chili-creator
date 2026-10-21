import { AlertTriangle, MessageSquare, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  byId,
  dialogText,
  giveDialog,
  parseScript,
  referencesTo,
  setDialogText,
  validate,
  type ScriptNode,
  type World,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select, Textarea } from '../../ui/input';
import { Segmented } from '../../ui/segmented';
import { dialogName, drawingName, Empty } from '../shared';

type View = 'text' | 'blocks';

const views = [
  { value: 'text', label: 'Text' },
  { value: 'blocks', label: 'Blocks' },
] as const;

interface Snippet {
  label: string;
  /** Text to put in; `wrap` goes around the selected text instead. */
  make(world: World): string | { wrap: [string, string] };
}

const firstVariable = (world: World) => world.variables[0]?.id ?? 'a';
const firstItem = (world: World) => world.items[0]?.name ?? world.items[0]?.id ?? 'key';

const snippets: Snippet[] = [
  { label: 'Wavy text', make: () => ({ wrap: ['{wvy}', '{wvy}'] }) },
  { label: 'Shaky text', make: () => ({ wrap: ['{shk}', '{shk}'] }) },
  { label: 'Rainbow text', make: () => ({ wrap: ['{rbw}', '{rbw}'] }) },
  { label: 'New page', make: () => '{pg}' },
  { label: 'Say lines in order', make: () => '{sequence\n  - the first time\n  - every time after\n}' },
  { label: 'Say lines round and round', make: () => '{cycle\n  - one\n  - two\n}' },
  { label: 'Say lines in any order', make: () => '{shuffle\n  - one\n  - two\n}' },
  {
    label: 'If a variable is…',
    make: (w) => `{\n  - ${firstVariable(w)} == 1 ?\n    it is one\n  - else ?\n    it is not\n}`,
  },
  {
    label: 'If the player has an item',
    make: (w) => `{\n  - {item "${firstItem(w)}"} > 0 ?\n    you have it\n  - else ?\n    you do not have it\n}`,
  },
  { label: 'Change a variable', make: (w) => `{${firstVariable(w)} = ${firstVariable(w)} + 1}` },
  { label: 'Show a variable', make: (w) => `{say ${firstVariable(w)}}` },
  { label: 'Go to a room', make: (w) => `{exit "${w.rooms[0]?.id ?? '0'}" 8 8}` },
  { label: 'End the game', make: () => '{end}' },
];

const listLabels = {
  sequence: 'In order, then stays on the last',
  cycle: 'In order, then again from the top',
  shuffle: 'In any order',
};

const effectLabels: Record<string, string> = {
  wvy: 'wavy',
  shk: 'shaky',
  rbw: 'rainbow',
  clr1: 'colour 1',
  clr2: 'colour 2',
  clr3: 'colour 3',
};

const unquote = (text = '') => text.replace(/^"(.*)"$/, '$1');

function describeCall(name: string, args: string[]): string {
  switch (name) {
    case 'end':
      return 'End the game';
    case 'exit':
      return `Go to room ${unquote(args[0])}${args.length >= 3 ? ` at ${args[1]},${args[2]}` : ''}`;
    case 'item':
      return `Number of ${unquote(args[0])}`;
    case 'printItem':
      return `Show the number of ${unquote(args[0])}`;
    case 'say':
    case 'print':
      return `Show ${args.join(' ')}`;
    case 'pg':
      return 'New page';
    case 'br':
      return 'New line';
    default:
      return `{${[name, ...args].join(' ')}}`;
  }
}

const chip = 'w-fit rounded border border-line bg-bg-3 px-1.5 py-0.5 font-mono text-[11px] text-text';

/** The script as nested blocks: text, effects, choices and actions. */
function Blocks({ nodes, label }: { nodes: ScriptNode[]; label?: string }) {
  return (
    <ul aria-label={label} className="space-y-1.5">
      {nodes.map((node, index) => (
        <li key={index}>
          {node.type === 'text' && <p className="text-sm whitespace-pre-wrap">{node.text}</p>}
          {node.type === 'effect' && <p className={chip}>{effectLabels[node.name] ?? node.name}</p>}
          {node.type === 'call' && <p className={chip}>{describeCall(node.name, node.args)}</p>}
          {node.type === 'assign' && <p className={chip}>{`Set ${node.variable} to ${node.expression}`}</p>}
          {node.type === 'list' && (
            <div className="rounded-md border border-line p-2">
              <p className="mb-1 text-[11px] tracking-wide text-muted uppercase">{listLabels[node.kind]}</p>
              <ol className="list-decimal space-y-1 pl-5">
                {node.options.map((option, n) => (
                  <li key={n}>
                    <Blocks nodes={option} />
                  </li>
                ))}
              </ol>
            </div>
          )}
          {node.type === 'branch' && (
            <div className="space-y-1 rounded-md border border-line p-2">
              {node.cases.map((branch, n) => (
                <div key={n}>
                  <p className="mb-1 text-[11px] tracking-wide text-phosphor">
                    {branch.condition === 'else' ? 'Otherwise' : branch.condition ? `If ${branch.condition}` : 'Always'}
                  </p>
                  <div className="border-l border-line pl-3">
                    <Blocks nodes={branch.body} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function DialogTool() {
  const creator = useCreator();
  const { world, kind, drawing, dialog } = useSelection();
  const [view, setView] = useState<View>('text');
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  if (!world) return <Empty icon={<MessageSquare />}>Open a game to write what its sprites and items say.</Empty>;

  const owner = drawing && kind ? drawingName(kind, drawing) : '';
  const id = dialog?.id;
  const text = id === undefined ? '' : (dialogText(world, id) ?? '');

  function write(next: string) {
    if (id === undefined) return;
    creator.projects.updateWorld((w) => setDialogText(w, id, next), { group: `dialog-${id}` });
  }

  function insert(label: string) {
    const snippet = snippets.find((s) => s.label === label);
    if (!snippet || !world) return;
    const field = textarea.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    const made = snippet.make(world);
    const piece = typeof made === 'string' ? made : made.wrap[0] + (text.slice(start, end) || 'text') + made.wrap[1];
    creator.projects.endGroup();
    write(text.slice(0, start) + piece + text.slice(end));
    creator.projects.endGroup();
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + piece.length, start + piece.length);
    });
  }

  function giveOwnerDialog() {
    if (!drawing || !kind) return;
    let made: string | null = null;
    creator.projects.updateWorld((w) => {
      made = giveDialog(w, kind, drawing.id);
    });
    if (made !== null) creator.editor.set({ dialog: made });
  }

  const saidBy = id === undefined ? [] : referencesTo(world, { type: 'dialog', id }).map((r) => r.label);
  const problems = id === undefined ? [] : validate(world).filter((p) => p.at.type === 'dialog' && p.at.id === id);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Dialog"
          value={id ?? ''}
          onChange={(event) => creator.editor.set({ dialog: event.target.value || null })}
          className="max-w-56 flex-1"
        >
          {id === undefined && <option value="">Pick a dialog…</option>}
          {[...world.dialogs, ...world.endings.filter((e) => !byId(world.dialogs, e.id))].map((d) => (
            <option key={d.id} value={d.id}>
              {dialogName(d)}
            </option>
          ))}
        </Select>
        {dialog && (
          <Segmented label="View" value={view} options={views} onChange={(value: View) => setView(value)} />
        )}
      </div>

      {!dialog && (
        <div className="space-y-3 text-sm text-muted">
          {kind === 'tiles' ? (
            <p>Tiles do not talk. Pick a sprite or item to write what it says, or a dialog above.</p>
          ) : drawing ? (
            <>
              <p>{owner} has nothing to say yet.</p>
              <Button size="sm" variant="primary" onClick={giveOwnerDialog}>
                <Plus />
                Write what {owner} says
              </Button>
            </>
          ) : (
            <p>Pick a sprite or item to write what it says, or a dialog above.</p>
          )}
        </div>
      )}

      {dialog && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="mr-auto">{saidBy.length ? `Said by ${saidBy.join(', ')}` : 'Nobody says this yet'}</span>
            <Input
              aria-label="Dialog name"
              value={dialog.name ?? ''}
              placeholder={dialogName({ id: dialog.id })}
              className="w-40"
              onChange={(event) => {
                const value = event.target.value;
                creator.projects.updateWorld(
                  (w) => {
                    const target = byId(w.dialogs, dialog.id);
                    if (!target) return;
                    if (value) target.name = value;
                    else delete target.name;
                  },
                  { group: `dialog-name-${dialog.id}` },
                );
              }}
            />
          </div>

          {view === 'text' ? (
            <>
              <Textarea
                ref={textarea}
                aria-label="Dialog text"
                value={text}
                spellCheck
                className="min-h-40 flex-1"
                onChange={(event) => write(event.target.value)}
                onBlur={() => creator.projects.endGroup()}
              />
              <Select aria-label="Insert" value="" onChange={(event) => insert(event.target.value)} className="w-fit">
                <option value="">Insert…</option>
                {snippets.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <div className="space-y-2">
              <Blocks nodes={parseScript(dialog.script)} label="Blocks" />
              <p className="text-[11px] text-muted">Switch to Text to change it.</p>
            </div>
          )}

          {problems.length > 0 && (
            <ul aria-label="Problems in this dialog" className="space-y-1 text-xs">
              {problems.map((problem) => (
                <li key={problem.message} className="flex items-start gap-2 text-amber">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {problem.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default defineTool({
  id: 'dialog',
  title: 'Dialog',
  icon: MessageSquare,
  component: DialogTool,
  defaultPosition: 'within',
  defaultReference: 'paint',
  openByDefault: true,
  openInBackground: true,
});
