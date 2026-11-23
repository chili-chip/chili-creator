import { DoorOpen, Eraser, Flag, Map as MapIcon, MousePointer2, Plus, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Checkbox, Input, Select } from '../../../ui/input';
import { PixelCanvas } from '../../../ui/pixel-canvas';
import { Segmented } from '../../../ui/segmented';
import { addRoom, deleteRoom, objectsAt, paintCell, place, removeAt, renameRoom, resizeRoom, roomById, whole, type Placeable } from '../edit';
import { LIMITS, type Game, type Room } from '../model';
import { lookSprite, roomRGBA, tileSprite } from '../render';
import { useGame, useSelection } from '../state';
import { ErrorLine, Sprite, useEdit } from './shared';

type Mode = 'ground' | 'top' | 'place';
/** What a click does in Place mode. */
type PlaceBrush = 'pick' | 'remove' | 'start' | 'warp' | 'trigger' | `kind:${string}` | `item:${string}`;

const EMPTY_TOP = ' ';

function brushToPlaceable(brush: PlaceBrush): Placeable | null {
  if (brush === 'start') return { start: true };
  if (brush === 'warp') return { warp: true };
  if (brush === 'trigger') return { trigger: true };
  if (brush.startsWith('kind:')) return { kind: brush.slice(5) };
  if (brush.startsWith('item:')) return { item: brush.slice(5) };
  return null;
}

/** Outlines warps (cyan) and triggers (yellow) over the room picture. */
function withMarkers(pixels: Uint8ClampedArray, room: Room, picked: { x: number; y: number } | null) {
  const out = pixels.slice();
  const w = (room.ground[0]?.length ?? 0) * 8;
  const box = (x: number, y: number, rgb: [number, number, number]) => {
    for (let i = 0; i < 8; i++) {
      for (const [px, py] of [[x * 8 + i, y * 8], [x * 8 + i, y * 8 + 7], [x * 8, y * 8 + i], [x * 8 + 7, y * 8 + i]] as const) {
        out.set([...rgb, 255], (py * w + px) * 4);
      }
    }
  };
  room.warps?.forEach((warp) => box(warp.x, warp.y, [0x73, 0xef, 0xf7]));
  room.triggers?.forEach((t) => box(t.x, t.y, [0xff, 0xcd, 0x75]));
  if (picked) box(picked.x, picked.y, [0xf4, 0xf4, 0xf4]);
  return out;
}

function Brushes({ game, mode, tile, onTile, placeBrush, onPlace }: {
  game: Game;
  mode: Mode;
  tile: string;
  onTile(key: string): void;
  placeBrush: PlaceBrush;
  onPlace(brush: PlaceBrush): void;
}) {
  const option = (checked: boolean, label: string, onClick: () => void, content: React.ReactNode) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid min-h-7 min-w-7 place-items-center rounded border-2 border-line p-0.5 aria-checked:border-phosphor"
    >
      {content}
    </button>
  );
  if (mode !== 'place') {
    return (
      <div role="radiogroup" aria-label="Brush" className="flex flex-wrap gap-1">
        {game.tiles.map((t) => option(tile === t.key, `Tile ${t.key}`, () => onTile(t.key), <Sprite game={game} n={tileSprite(t.sprite)} className="size-5" />))}
        {mode === 'top' && option(tile === EMPTY_TOP, 'Empty', () => onTile(EMPTY_TOP), <Eraser className="size-4" />)}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="Place" className="flex flex-wrap gap-1">
      {option(placeBrush === 'pick', 'Pick', () => onPlace('pick'), <MousePointer2 className="size-4" />)}
      {option(placeBrush === 'start', 'Start', () => onPlace('start'), <Flag className="size-4" />)}
      {option(placeBrush === 'warp', 'Warp', () => onPlace('warp'), <DoorOpen className="size-4" />)}
      {option(placeBrush === 'trigger', 'Trigger', () => onPlace('trigger'), <Zap className="size-4" />)}
      {(game.kinds ?? []).map((k) => option(placeBrush === `kind:${k.id}`, `Character ${k.name ?? k.id}`, () => onPlace(`kind:${k.id}`), <Sprite game={game} n={lookSprite(k)} className="size-5" />))}
      {(game.items ?? []).map((i) => option(placeBrush === `item:${i.id}`, `Item ${i.name ?? i.id}`, () => onPlace(`item:${i.id}`), <Sprite game={game} n={i.icon} className="size-5" />))}
      {option(placeBrush === 'remove', 'Remove', () => onPlace('remove'), <Trash2 className="size-4" />)}
    </div>
  );
}

/** What stands on the picked cell, with its settings. */
function Picked({ game, room, x, y, edit }: { game: Game; room: Room; x: number; y: number; edit(recipe: (g: Game) => void, group?: string): void }) {
  const objects = objectsAt(room, x, y);
  const isStart = game.start.room === room.id && game.start.x === x && game.start.y === y;
  const inRoom = (g: Game) => roomById(g, room.id);
  return (
    <section aria-label="Picked cell" className="space-y-2">
      <h3 className="font-semibold">
        Cell {x}, {y}
      </h3>
      {isStart && <p>The hero starts here.</p>}
      {!objects.length && !isStart && <p className="text-muted">Nothing here.</p>}
      {objects.map(({ type, index }) => {
        if (type === 'actor') {
          const actor = room.actors![index]!;
          return <p key={`a${index}`}>Character: {game.kinds?.find((k) => k.id === actor.kind)?.name ?? actor.kind}</p>;
        }
        if (type === 'item') {
          const item = room.items![index]!;
          return (
            <label key={`i${index}`} className="flex items-center gap-1">
              Item: {game.items?.find((i) => i.id === item.item)?.name ?? item.item}, how many
              <Input
                aria-label="How many"
                type="number"
                min={1}
                max={99}
                className="w-16"
                value={item.count ?? 1}
                onChange={(event) =>
                  edit((g) => {
                    const it = inRoom(g).items![index]!;
                    const n = whole(event.target.value, 1, 99);
                    if (n > 1) it.count = n;
                    else delete it.count;
                  }, `count-${room.id}-${index}`)
                }
              />
            </label>
          );
        }
        if (type === 'warp') {
          const warp = room.warps![index]!;
          const target = game.rooms.find((r) => r.id === warp.to) ?? room;
          return (
            <div key={`w${index}`} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                Warp to room
                <Select aria-label="Warp to room" value={warp.to} onChange={(event) => edit((g) => void (inRoom(g).warps![index]!.to = event.target.value))}>
                  {game.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name ?? r.id}
                    </option>
                  ))}
                </Select>
              </label>
              {(['tx', 'ty'] as const).map((axis) => (
                <label key={axis} className="flex flex-col gap-1">
                  {axis === 'tx' ? 'x' : 'y'}
                  <Input
                    aria-label={`Warp to ${axis === 'tx' ? 'x' : 'y'}`}
                    type="number"
                    min={0}
                    className="w-16"
                    value={warp[axis]}
                    onChange={(event) => {
                      const max = axis === 'tx' ? (target.ground[0]?.length ?? 16) - 1 : target.ground.length - 1;
                      edit((g) => void (inRoom(g).warps![index]![axis] = whole(event.target.value, 0, max)), `warp-${room.id}-${index}`);
                    }}
                  />
                </label>
              ))}
            </div>
          );
        }
        const trigger = room.triggers![index]!;
        return (
          <div key={`t${index}`} className="space-y-1">
            <p>Trigger: runs when the hero steps here.</p>
            <Checkbox
              label="Only once"
              checked={trigger.once ?? true}
              onChange={(event) =>
                edit((g) => {
                  const t = inRoom(g).triggers![index]!;
                  if (event.target.checked) delete t.once;
                  else t.once = false;
                })
              }
            />
          </div>
        );
      })}
      {objects.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => edit((g) => removeAt(g, room.id, x, y))}>
          <Trash2 /> Remove what is here
        </Button>
      )}
    </section>
  );
}

function Rooms() {
  const { projects } = useCreator();
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  const [mode, setMode] = useState<Mode>('ground');
  const [topErase, setTopErase] = useState(false);
  const [placeBrush, setPlaceBrush] = useState<PlaceBrush>('pick');
  const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ room: string; w: number; h: number } | null>(null);
  const room = selection.room;
  const pixels = useMemo(() => (game && room ? roomRGBA(game, room, { top: mode !== 'ground' }) : new Uint8ClampedArray(4)), [game, room, mode]);
  if (!game || !room) return <Empty icon={<MapIcon />}>Open a Chili RPG game to build its rooms.</Empty>;

  const width = room.ground[0]?.length ?? 16;
  const height = room.ground.length;
  const tile = mode === 'top' && topErase ? EMPTY_TOP : (selection.tile?.key ?? '.');
  const draft = size?.room === room.id ? size : { room: room.id, w: width, h: height };
  const shownPick = mode === 'place' && picked && picked.x < width && picked.y < height ? picked : null;

  function paint(x: number, y: number) {
    if (mode !== 'place') {
      edit((g) => paintCell(g, room!.id, mode, x, y, tile), `paint-${room!.id}`);
      return;
    }
    setPicked({ x, y });
    if (placeBrush === 'remove') edit((g) => removeAt(g, room!.id, x, y));
    const what = brushToPlaceable(placeBrush);
    if (what) edit((g) => place(g, room!.id, what, x, y));
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Mode>
            label="Layer"
            value={mode}
            options={[
              { value: 'ground', label: 'Ground' },
              { value: 'top', label: 'Top' },
              { value: 'place', label: 'Place' },
            ]}
            onChange={setMode}
          />
          <Brushes
            game={game}
            mode={mode}
            tile={tile}
            onTile={(key) => {
              setTopErase(key === EMPTY_TOP);
              if (key !== EMPTY_TOP) selection.set({ tile: key });
            }}
            placeBrush={placeBrush}
            onPlace={setPlaceBrush}
          />
        </div>
        <div className="relative w-full max-w-[640px]" style={{ aspectRatio: `${width} / ${height}` }}>
          <PixelCanvas
            label={`Room ${room.id}, ${mode === 'place' ? 'place' : `${mode} layer`}`}
            pixels={withMarkers(pixels, room, shownPick)}
            width={width * 8}
            height={height * 8}
            columns={width}
            rows={height}
            className="aspect-auto size-full"
            onPaint={paint}
            onStrokeEnd={() => projects.endGroup()}
          />
          <div
            aria-hidden
            title="The HUD covers this row when the view is at the top"
            className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-white/40"
            style={{ height: `${100 / height}%` }}
          />
        </div>
        <p className="text-muted">
          {mode === 'top'
            ? 'The top layer is drawn over people: roofs, tree tops, arches.'
            : mode === 'place'
              ? 'Warps are cyan, triggers yellow. Pick a cell to change what is on it.'
              : 'The dashed row sits under the HUD.'}
        </p>
        <ErrorLine error={error} />
      </section>

      <section className="flex flex-col gap-3 lg:w-60">
        <ul aria-label="Rooms" className="flex flex-wrap gap-1">
          {game.rooms.map((r) => (
            <li key={r.id}>
              <Button size="sm" variant={r.id === room.id ? 'primary' : 'secondary'} aria-pressed={r.id === room.id} onClick={() => selection.set({ room: r.id })}>
                {r.id === game.start.room && <Flag />}
                {r.name || r.id}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={game.rooms.length >= LIMITS.rooms} onClick={() => edit((g) => selection.set({ room: addRoom(g).id }))}>
            <Plus /> Add room
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete room ${room.id}`}
            disabled={game.start.room === room.id}
            onClick={() => {
              edit((g) => deleteRoom(g, room.id));
              selection.set({ room: null });
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <label className="flex flex-col gap-1">
          Id
          <Input
            aria-label="Room id"
            defaultValue={room.id}
            key={room.id}
            title="Used in the file and by warps"
            onBlur={(event) => {
              const id = event.target.value.trim();
              if (id === room.id) return;
              edit((g) => renameRoom(g, room.id, id));
              selection.set({ room: id });
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          Name
          <Input
            aria-label="Room name"
            value={room.name ?? ''}
            maxLength={24}
            onChange={(event) =>
              edit((g) => {
                const r = roomById(g, room.id);
                if (event.target.value) r.name = event.target.value;
                else delete r.name;
              }, `name-${room.id}`)
            }
          />
        </label>
        {(game.songs ?? []).length > 0 && (
          <label className="flex flex-col gap-1">
            Music
            <Select
              aria-label="Music"
              value={room.music ?? ''}
              onChange={(event) =>
                edit((g) => {
                  const r = roomById(g, room.id);
                  if (event.target.value) r.music = event.target.value;
                  else delete r.music;
                })
              }
            >
              <option value="">None</option>
              {game.songs!.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </Select>
          </label>
        )}
        <div className="flex items-end gap-1">
          {(['w', 'h'] as const).map((axis) => (
            <label key={axis} className="flex flex-col gap-1">
              {axis === 'w' ? 'Width' : 'Height'}
              <Input
                aria-label={axis === 'w' ? 'Width' : 'Height'}
                type="number"
                min={LIMITS.roomMin}
                max={LIMITS.roomMax}
                className="w-16"
                value={draft[axis]}
                onChange={(event) => setSize({ ...draft, [axis]: Number(event.target.value) })}
              />
            </label>
          ))}
          <Button
            size="sm"
            disabled={draft.w === width && draft.h === height}
            onClick={() => {
              edit((g) => resizeRoom(g, room.id, whole(draft.w, LIMITS.roomMin, LIMITS.roomMax), whole(draft.h, LIMITS.roomMin, LIMITS.roomMax)));
              setSize(null);
            }}
          >
            Resize
          </Button>
        </div>
        <p className="text-muted">
          {LIMITS.roomMin} to {LIMITS.roomMax} tiles. Rooms bigger than the screen scroll with the hero.
        </p>
        {shownPick && <Picked game={game} room={room} x={shownPick.x} y={shownPick.y} edit={edit} />}
      </section>
    </div>
  );
}

export default defineTool({
  id: 'rpg-rooms',
  title: 'Rooms',
  icon: MapIcon,
  help: 'Paint the ground and the top layer, place the start, people, items, warps and triggers, and set each room size.',
  component: Rooms,
  openByDefault: true,
});
