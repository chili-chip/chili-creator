import { Palette as PaletteIcon, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addPalette, byId, removePalette, type Rgb, type World } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select } from '../../ui/input';
import { Confirm, Empty, newGroup, roomName } from '../shared';

export function rgbToHex(color: Rgb): string {
  return `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return match ? [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)] : null;
}

const roles = ['Background', 'Tiles', 'Sprites and items'];

/** A colour typed as hex; it changes the palette once it is a whole colour. */
function HexField({ label, color, onColor }: { label: string; color: Rgb; onColor(rgb: Rgb): void }) {
  const [draft, setDraft] = useState(rgbToHex(color));
  useEffect(() => setDraft(rgbToHex(color)), [color]);
  return (
    <Input
      aria-label={`${label} hex`}
      value={draft}
      spellCheck={false}
      className="h-7 w-24 py-0 font-mono text-xs"
      onChange={(event) => {
        const value = event.target.value.trim();
        setDraft(value);
        const rgb = hexToRgb(value.startsWith('#') ? value : `#${value}`);
        if (rgb) onColor(rgb);
      }}
      onBlur={() => setDraft(rgbToHex(color))}
    />
  );
}

function Colors() {
  const creator = useCreator();
  const { world, room } = useSelection();
  // One picker drag is one undo step: the group lasts until the picker is let go.
  const groups = useRef(new Map<number, string>());
  const [deleting, setDeleting] = useState(false);

  if (!world || !room) return <Empty icon={<PaletteIcon />}>Open a game to choose its colours.</Empty>;

  const roomId = room.id;
  const palette = (room.palette !== undefined && byId(world.palettes, room.palette)) || world.palettes[0];

  function edit(recipe: (w: World) => void, group?: string) {
    creator.projects.updateDoc<World>(recipe, group === undefined ? {} : { group });
  }

  function newPalette() {
    edit((w) => {
      const id = addPalette(w, palette?.id);
      const target = byId(w.rooms, roomId);
      if (target) target.palette = id;
    });
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <p className="text-xs text-muted">Colours of {roomName(room)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Palette"
          value={palette?.id ?? ''}
          onChange={(event) => {
            const id = event.target.value;
            edit((w) => {
              const target = byId(w.rooms, roomId);
              if (target) target.palette = id;
            });
          }}
          className="max-w-48"
        >
          {world.palettes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || `Palette ${p.id}`}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={newPalette}>
          <Plus />
          New palette
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete palette"
          title={world.palettes.length < 2 ? 'A game needs one palette' : 'Delete palette'}
          disabled={world.palettes.length < 2}
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
        </Button>
        {deleting && palette && (
          <Confirm
            question={`Delete “${palette.name || `Palette ${palette.id}`}”? Its rooms take another palette.`}
            onKeep={() => setDeleting(false)}
            onDelete={() => {
              edit((w) => void removePalette(w, palette.id));
              setDeleting(false);
            }}
          />
        )}
      </div>

      {palette && (
        <>
          <Input
            aria-label="Palette name"
            value={palette.name ?? ''}
            placeholder={`Palette ${palette.id}`}
            onChange={(event) => {
              const value = event.target.value;
              const id = palette.id;
              edit((w) => {
                const target = byId(w.palettes, id);
                if (!target) return;
                if (value) target.name = value;
                else delete target.name;
              }, `palette-name-${id}`);
            }}
          />
          <ul className="space-y-2">
            {palette.colors.map((color, index) => {
              const label = roles[index] ?? `Colour ${index}`;
              const id = `colour-${palette.id}-${index}`;
              return (
                <li key={index} className="flex items-center gap-3">
                  <input
                    id={id}
                    aria-label={label}
                    type="color"
                    value={rgbToHex(color)}
                    className="h-9 w-12 cursor-pointer rounded border border-line bg-bg-0 p-0.5"
                    onInput={(event) => {
                      const rgb = hexToRgb(event.currentTarget.value);
                      if (!rgb) return;
                      if (!groups.current.has(index)) groups.current.set(index, newGroup('colour'));
                      const paletteId = palette.id;
                      edit((w) => {
                        const target = byId(w.palettes, paletteId);
                        if (target) target.colors[index] = rgb;
                      }, groups.current.get(index));
                    }}
                    onChange={() => {}}
                    onBlur={() => {
                      groups.current.delete(index);
                      creator.projects.endGroup();
                    }}
                  />
                  <label htmlFor={id} className="flex-1 text-sm">
                    {label}
                  </label>
                  <HexField
                    label={label}
                    color={color}
                    onColor={(rgb) => {
                      const paletteId = palette.id;
                      edit((w) => {
                        const target = byId(w.palettes, paletteId);
                        if (target) target.colors[index] = rgb;
                      }, `hex-${paletteId}-${index}`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default defineTool({
  id: 'colors',
  title: 'Colors',
  help: 'Palettes of three colours: the background, tiles, and sprites and items. Each room uses one.',
  icon: PaletteIcon,
  component: Colors,
  defaultPosition: 'within',
  defaultReference: 'library',
  openByDefault: true,
  openInBackground: true,
});
