import { DoorOpen, Eraser, Flag, Map as MapIcon, MousePointer2, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  addEnding,
  addExit,
  addRoom,
  AVATAR,
  byId,
  endingAt,
  eraseAt,
  eraseMarkerAt,
  exitAt,
  markRoom,
  paintTile,
  placeSprite,
  referencesTo,
  removeRoom,
  ROOM_PIXELS,
  ROOM_SIZE,
  roomPixels,
  toggleItem,
  tuneName,
  type World,
} from '../../bitsy';
import type { RoomTool } from '../../project/editor';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select } from '../../ui/input';
import { PixelCanvas, type Cell } from '../../ui/pixel-canvas';
import { Segmented } from '../../ui/segmented';
import { Confirm, count, drawingName, Empty, newGroup, roomName } from '../shared';

const roomTools = [
  { value: 'place', label: 'Place', icon: MousePointer2, hint: 'P' },
  { value: 'erase', label: 'Erase', icon: Eraser, hint: 'E' },
  { value: 'exit', label: 'Exit', icon: DoorOpen, hint: 'X' },
  { value: 'ending', label: 'Ending', icon: Flag, hint: 'N' },
] as const;

function RoomTool() {
  const creator = useCreator();
  const editor = useEditor();
  const { world, room, kind, drawing } = useSelection();
  const [hover, setHover] = useState<Cell | null>(null);
  const [confirming, setConfirming] = useState(false);
  const stroke = useRef<{ group: string; tile?: string } | null>(null);

  if (!world || !room) return <Empty icon={<MapIcon />}>Open a game to build its rooms.</Empty>;

  const roomId = room.id;
  const erasing = editor.roomTool === 'erase';
  const brush = drawing && kind ? drawingName(kind, drawing) : '';
  const hint = erasing
    ? 'Click to erase'
    : editor.roomTool === 'exit'
      ? 'Click to add an exit, or pick one'
      : editor.roomTool === 'ending'
        ? 'Click to add an ending, or pick one'
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
      edit((w) => void (eraseMarkerAt(w, roomId, x, y) || eraseAt(w, roomId, x, y)), current.group);
      return;
    }
    if (editor.roomTool === 'exit' || editor.roomTool === 'ending') {
      if (!first) return;
      const marked = exitAt(room!, x, y) >= 0 || endingAt(room!, x, y);
      const adding = editor.roomTool === 'exit' ? addExit : addEnding;
      if (!marked) edit((w) => void adding(w, roomId, x, y), current.group);
      creator.editor.set({ marker: { x, y } });
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
    creator.editor.set({ room: id, marker: null });
  }

  function deleteRoom() {
    creator.projects.updateWorld((w) => void removeRoom(w, roomId));
    setConfirming(false);
    creator.editor.set({ room: null, marker: null });
  }

  const avatarHere = byId(world.sprites, AVATAR)?.position?.room === roomId;
  const uses = referencesTo(world, { type: 'room', room: roomId }).length;
  const pixels = roomPixels(world, roomId);
  markRoom(pixels, room, editor.marker);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Room"
          value={roomId}
          onChange={(event) => {
            setConfirming(false);
            creator.editor.set({ room: event.target.value, marker: null });
          }}
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
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete room"
          title={avatarHere ? 'The avatar is in this room, so it stays' : 'Delete room'}
          disabled={avatarHere || world.rooms.length < 2}
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
        </Button>
        <Segmented
          label="Room tool"
          value={editor.roomTool}
          options={roomTools}
          onChange={(value: RoomTool) => creator.editor.set({ roomTool: value })}
          compact
        />
        {confirming && (
          <Confirm
            question={`Delete “${roomName(room)}”${uses ? ` and the exits into it (${count(uses, 'use')})` : ''}?`}
            onKeep={() => setConfirming(false)}
            onDelete={deleteRoom}
          />
        )}
      </div>

      {/* The room fits the panel both ways, so every cell can be clicked. */}
      <div className="grid min-h-48 flex-1 items-start justify-items-center [container-type:size]">
        <PixelCanvas
          label={`Room ${roomName(room)}`}
          pixels={pixels}
          width={ROOM_PIXELS}
          height={ROOM_PIXELS}
          columns={ROOM_SIZE}
          rows={ROOM_SIZE}
          className="size-[min(100cqw,100cqh,640px)]"
          onPaint={paint}
          onStrokeEnd={() => {
            stroke.current = null;
            creator.projects.endGroup();
          }}
          onHover={setHover}
        />
      </div>

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

      <label className="flex items-center gap-2 text-xs text-muted">
        Music
        <Select
          aria-label="Music"
          value={room.tune !== undefined && byId(world.tunes, room.tune) ? room.tune : ''}
          className="flex-1"
          onChange={(event) => {
            const value = event.target.value;
            creator.projects.updateWorld((w) => {
              const target = byId(w.rooms, roomId);
              if (!target) return;
              if (value) target.tune = value;
              else delete target.tune;
            });
          }}
        >
          <option value="">None</option>
          {world.tunes.map((t) => (
            <option key={t.id} value={t.id}>
              {tuneName(t)}
            </option>
          ))}
        </Select>
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
