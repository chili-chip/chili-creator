import { Palette as PaletteIcon, Plus } from 'lucide-react';
import { useRef } from 'react';
import { addPalette, byId, type Rgb, type World } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select } from '../../ui/input';
import { Empty, newGroup, roomName } from '../shared';

export function rgbToHex(color: Rgb): string {
  return `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return match ? [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)] : null;
}

const roles = ['Background', 'Tiles', 'Sprites and items'];

function Colors() {
  const creator = useCreator();
  const { world, room } = useSelection();
  // One picker drag is one undo step: the group lasts until the picker is let go.
  const groups = useRef(new Map<number, string>());

  if (!world || !room) return <Empty icon={<PaletteIcon />}>Open a game to choose its colours.</Empty>;

  const roomId = room.id;
  const palette = (room.palette !== undefined && byId(world.palettes, room.palette)) || world.palettes[0];

  function edit(recipe: (w: World) => void, group?: string) {
    creator.projects.updateWorld(recipe, group === undefined ? {} : { group });
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
                  <label htmlFor={id} className="text-sm">
                    {label}
                    <span className="block text-[11px] text-muted">{rgbToHex(color)}</span>
                  </label>
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
  icon: PaletteIcon,
  component: Colors,
  defaultPosition: 'within',
  defaultReference: 'library',
  openByDefault: true,
  openInBackground: true,
});
