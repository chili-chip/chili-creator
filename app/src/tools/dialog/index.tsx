import { AlertTriangle, Copy, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  addDialog,
  byId,
  dialogText,
  giveDialog,
  parseScript,
  removeDialog,
  printScript,
  referencesTo,
  setDialogText,
  validate,
  type World,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select, Textarea } from '../../ui/input';
import { Segmented } from '../../ui/segmented';
import { Confirm, dialogName, drawingName, Empty } from '../shared';
import { blockKinds, BlockList } from './blocks';

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

// The rest of the block view's actions, written out as script.
for (const kind of blockKinds.flatMap((g) => g.kinds)) {
  if (kind.label === 'Text' || snippets.some((s) => s.label === kind.label)) continue;
  snippets.push({ label: kind.label, make: (w) => printScript(kind.make(w)) });
}

function DialogTool() {
  const creator = useCreator();
  const { world, kind, drawing, dialog } = useSelection();
  const [view, setView] = useState<View>('text');
  const [deleting, setDeleting] = useState(false);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  if (!world) return <Empty icon={<MessageSquare />}>Open a game to write what its sprites and items say.</Empty>;

  const owner = drawing && kind ? drawingName(kind, drawing) : '';
  const id = dialog?.id;
  const text = id === undefined ? '' : (dialogText(world, id) ?? '');

  function write(next: string) {
    if (id === undefined) return;
    creator.projects.updateDoc<World>((w) => setDialogText(w, id, next), { group: `dialog-${id}` });
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
    creator.projects.updateDoc<World>((w) => {
      made = giveDialog(w, kind, drawing.id);
    });
    if (made !== null) creator.editor.set({ dialog: made });
  }

  function newDialog(copyOf?: string) {
    let made: string | undefined;
    creator.projects.updateDoc<World>((w) => {
      const source = copyOf === undefined ? undefined : byId(w.dialogs, copyOf);
      made = addDialog(w, source ? (dialogText(w, source.id) ?? '') : '', source ? `${dialogName(source)} copy` : undefined);
    });
    setDeleting(false);
    if (made !== undefined) creator.editor.set({ dialog: made });
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
        <Button size="sm" variant="ghost" onClick={() => newDialog()}>
          <Plus />
          New dialog
        </Button>
        {dialog && byId(world.dialogs, dialog.id) && !world.rooms.some((r) => r.endings.some((e) => e.id === dialog.id)) && (
          <>
            <Button size="icon" variant="ghost" aria-label="Copy dialog" title="Copy dialog" onClick={() => newDialog(dialog.id)}>
              <Copy />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete dialog" title="Delete dialog" onClick={() => setDeleting(true)}>
              <Trash2 />
            </Button>
          </>
        )}
        {deleting && dialog && (
          <Confirm
            question={`Delete “${dialogName(dialog)}”?${saidBy.length ? ` ${saidBy.join(', ')} will have nothing to say.` : ''}`}
            onKeep={() => setDeleting(false)}
            onDelete={() => {
              creator.projects.updateDoc<World>((w) => void removeDialog(w, dialog.id));
              setDeleting(false);
              creator.editor.set({ dialog: null });
            }}
          />
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
                creator.projects.updateDoc<World>(
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
            <BlockList nodes={parseScript(dialog.script)} world={world} label="Blocks" onChange={(nodes) => write(printScript(nodes))} />
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
  help: 'What sprites and items say, and the text of endings. Write it, or build it from blocks: choices, conditions and actions.',
  icon: MessageSquare,
  component: DialogTool,
  defaultPosition: 'within',
  defaultReference: 'paint',
  openByDefault: true,
  openInBackground: true,
});
