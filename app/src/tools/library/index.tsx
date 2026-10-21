import { Box, Copy, Ghost, Grid2x2, Library as LibraryIcon, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  addDrawing,
  AVATAR,
  colorsFor,
  drawingPixels,
  drawingsOf,
  duplicateDrawing,
  removeDrawing,
  type DrawingKind,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { PixelImage } from '../../ui/pixel-canvas';
import { Segmented } from '../../ui/segmented';
import { Confirm, drawingName, Empty, kinds } from '../shared';

const tabs = [
  { value: 'tiles', label: 'Tiles', icon: Grid2x2 },
  { value: 'sprites', label: 'Sprites', icon: Ghost },
  { value: 'items', label: 'Items', icon: Box },
] as const;

function Library() {
  const creator = useCreator();
  const editor = useEditor();
  const { world, room, drawing: picked, kind: pickedKind } = useSelection();
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!world) return <Empty icon={<LibraryIcon />}>Open a game to see its tiles, sprites and items.</Empty>;

  const kind = editor.libraryTab;
  const colors = colorsFor(world, room?.id);
  const needle = query.trim().toLowerCase();
  const shown = drawingsOf(world, kind).filter(
    (d) => !needle || drawingName(kind, d).toLowerCase().includes(needle) || d.id.toLowerCase() === needle,
  );
  const current = pickedKind === kind ? picked : undefined;
  const currentName = current ? drawingName(kind, current) : '';

  function make() {
    let id = '';
    creator.projects.updateWorld((w) => {
      id = addDrawing(w, kind);
    });
    creator.editor.select({ kind, id });
  }

  function duplicate() {
    if (!current) return;
    let id: string | null = null;
    creator.projects.updateWorld((w) => {
      id = duplicateDrawing(w, kind, current.id);
    });
    if (id) creator.editor.select({ kind, id });
  }

  function remove() {
    if (!current) return;
    creator.projects.updateWorld((w) => void removeDrawing(w, kind, current.id));
    setConfirming(false);
    const { open } = creator.projects.getState();
    if (open.status !== 'ready') return;
    const next = kind === 'sprites' ? AVATAR : drawingsOf(open.world, kind)[0]?.id;
    creator.editor.set({ drawing: next === undefined ? null : { kind, id: next }, frame: 0 });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <Segmented
          label="Kind"
          value={kind}
          options={tabs}
          onChange={(value: DrawingKind) => {
            setConfirming(false);
            creator.editor.set({ libraryTab: value });
          }}
        />
        <Input
          type="search"
          aria-label="Find"
          placeholder="Find…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-28 flex-1"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {shown.length === 0 && needle && <p className="p-2 text-sm text-muted">Nothing matches “{query.trim()}”.</p>}
        <ul aria-label={kinds[kind].many} className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
          {shown.map((d) => {
            const name = drawingName(kind, d);
            const pressed = current?.id === d.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-label={name}
                  aria-pressed={pressed}
                  title={`${name} (${kind === 'tiles' ? 'TIL' : kind === 'sprites' ? 'SPR' : 'ITM'} ${d.id})`}
                  onClick={() => {
                    setConfirming(false);
                    creator.editor.select({ kind, id: d.id });
                  }}
                  className="group flex w-full flex-col items-center gap-1 rounded-md border border-line bg-bg-0 p-1.5 text-[11px] text-muted hover:border-muted/60 hover:text-text aria-pressed:border-chili aria-pressed:text-text"
                >
                  <PixelImage
                    pixels={drawingPixels(d, 0, colors, kind)}
                    width={8}
                    height={8}
                    className="aspect-square w-full rounded-sm"
                  />
                  <span className="w-full truncate">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-line p-2">
        <Button size="sm" variant="primary" onClick={make}>
          <Plus />
          New {kinds[kind].one}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Duplicate ${currentName}`}
          title="Duplicate"
          disabled={!current}
          onClick={duplicate}
        >
          <Copy />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${currentName}`}
          title={current?.id === AVATAR && kind === 'sprites' ? 'The avatar cannot be deleted' : 'Delete'}
          disabled={!current || (kind === 'sprites' && current.id === AVATAR)}
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
        </Button>
        {confirming && current && (
          <Confirm
            question={`Delete “${currentName}” and take it out of every room?`}
            onKeep={() => setConfirming(false)}
            onDelete={remove}
          />
        )}
      </div>
    </div>
  );
}

export default defineTool({
  id: 'library',
  title: 'Library',
  icon: LibraryIcon,
  component: Library,
  defaultPosition: 'below',
  defaultReference: 'paint',
  openByDefault: true,
});
