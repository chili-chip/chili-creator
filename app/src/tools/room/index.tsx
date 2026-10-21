import { Eraser, Map as MapIcon, MousePointer2, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  addRoom,
  byId,
  eraseAt,
  paintTile,
  placeSprite,
  ROOM_PIXELS,
  ROOM_SIZE,
  roomPixels,
  toggleItem,
  type World,
} from '../../bitsy';
import type { RoomTool } from '../../project/editor';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select } from '../../ui/input';
import { PixelCanvas, type Cell } from '../../ui/pixel-canvas';
import { Segmented } from '../../ui/segmented';
import { drawingName, Empty, newGroup, roomName } from '../shared';

const roomTools = [
  { value: 'place', label: 'Place', icon: MousePointer2, hint: 'P' },
  { value: 'erase', label: 'Erase', icon: Eraser, hint: 'E' },
] as const;

function RoomTool() {
  const creator = useCreator();
  const editor = useEditor();
  const { world, room, kind, drawing } = useSelection();
  const [hover, setHover] = useState<Cell | null>(null);
  const stroke = useRef<{ group: string; tile?: string } | null>(null);

  if (!world || !room) return <Empty icon={<MapIcon />}>Open a game to build its rooms.</Empty>;

  const roomId = room.id;
  const erasing = editor.roomTool === 'erase';
  const brush = drawing && kind ? drawingName(kind, drawing) : '';
  const hint = erasing
    ? 'Click to erase'
    : !drawing
      ? 'Pick something in the Library to place it'
      : kind === 'tiles'
        ? `Click to paint ${brush}`
        : kind === 'sprites'
          ? `Click to move ${brush}`
          : `Click to put down ${brush}`;

  function edit(recipe: (w: World) => void, group: string) {
    creator.projects.updateWorld(recipe, { group });
  }

  function paint(x: number, y: number, first: boolean) {
    if (first) {
      // Painting on the same tile clears it, for the whole stroke.
      const tile = kind === 'tiles' && drawing ? (room!.tilemap[y]?.[x] === drawing.id ? '0' : drawing.id) : undefined;
      stroke.current = { group: newGroup('room'), ...(tile === undefined ? {} : { tile }) };
    }
    const current = stroke.current;
    if (!current) return;
    if (erasing) {
      edit((w) => void eraseAt(w, roomId, x, y), current.group);
      return;
    }
    if (!drawing || !kind) return;
    if (kind === 'tiles') {
      const tile = current.tile!;
      edit((w) => {
        const target = byId(w.rooms, roomId);
        if (target) paintTile(target, x, y, tile);
      }, current.group);
    } else if (kind === 'sprites') {
      edit((w) => placeSprite(w, drawing.id, roomId, x, y), current.group);
    } else if (first) {
      edit((w) => {
        const target = byId(w.rooms, roomId);
        if (target) toggleItem(target, drawing.id, x, y);
      }, current.group);
    }
  }

  function newRoom() {
    let id = '';
    creator.projects.updateWorld((w) => {
      id = addRoom(w);
    });
    creator.editor.set({ room: id });
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Room"
          value={roomId}
          onChange={(event) => creator.editor.set({ room: event.target.value })}
          className="max-w-48"
        >
          {world.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {roomName(r)}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={newRoom}>
          <Plus />
          New room
        </Button>
        <Segmented
          label="Room tool"
          value={editor.roomTool}
          options={roomTools}
          onChange={(value: RoomTool) => creator.editor.set({ roomTool: value })}
        />
      </div>

      <PixelCanvas
        label={`Room ${roomName(room)}`}
        pixels={roomPixels(world, roomId)}
        width={ROOM_PIXELS}
        height={ROOM_PIXELS}
        columns={ROOM_SIZE}
        rows={ROOM_SIZE}
        className="mx-auto w-full max-w-[min(100%,640px)] shrink-0"
        onPaint={paint}
        onStrokeEnd={() => {
          stroke.current = null;
          creator.projects.endGroup();
        }}
        onHover={setHover}
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>{hint}</span>
        <span className="ml-auto tabular-nums" aria-live="off">
          {hover ? `x ${hover.x}, y ${hover.y}` : ''}
        </span>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        Name
        <Input
          aria-label="Room name"
          value={room.name ?? ''}
          placeholder={`Room ${roomId}`}
          className="flex-1"
          onChange={(event) => {
            const value = event.target.value;
            edit((w) => {
              const target = byId(w.rooms, roomId);
              if (!target) return;
              if (value) target.name = value;
              else delete target.name;
            }, `room-name-${roomId}`);
          }}
        />
      </label>
    </div>
  );
}

export default defineTool({
  id: 'room',
  title: 'Room',
  icon: MapIcon,
  component: RoomTool,
  defaultPosition: 'center',
  openByDefault: true,
  // The dashboard is in front until a game opens; then the shell shows the room.
  openInBackground: true,
});
