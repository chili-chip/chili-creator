import { ArrowRightLeft, DoorOpen, Flag, Lock, MessageSquare, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  byId,
  dialogText,
  markRoom,
  moveExit,
  removeEndingAt,
  removeExit,
  returnExitOf,
  reverseExit,
  setExitDest,
  setExitDialog,
  setTwoWay,
  ROOM_PIXELS,
  ROOM_SIZE,
  roomPixels,
  setDialogText,
  type Exit,
  type World,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Select, Textarea } from '../../ui/input';
import { PixelCanvas } from '../../ui/pixel-canvas';
import { cn } from '../../ui/cn';
import { Segmented } from '../../ui/segmented';
import { Confirm, Empty, roomName } from '../shared';

const transitions = [
  { value: '', label: 'None' },
  { value: 'fade_w', label: 'Fade to white' },
  { value: 'fade_b', label: 'Fade to black' },
  { value: 'wave', label: 'Wave' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'slide_u', label: 'Slide up' },
  { value: 'slide_d', label: 'Slide down' },
  { value: 'slide_l', label: 'Slide left' },
  { value: 'slide_r', label: 'Slide right' },
];

const listButton =
  'flex w-full items-center gap-2 rounded-md border border-line bg-bg-0 px-2 py-1.5 text-left text-xs text-muted hover:border-muted/60 hover:text-text aria-pressed:border-chili aria-pressed:text-text [&_svg]:size-4 [&_svg]:shrink-0';

const ways = [
  { value: 'both', label: 'Both ways' },
  { value: 'one', label: 'One way' },
] as const;

function TransitionSelect({ label, value, onChange }: { label: string; value: string | undefined; onChange(value: string): void }) {
  return (
    <Select aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      {transitions.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </Select>
  );
}

function ExitsTool() {
  const creator = useCreator();
  const editor = useEditor();
  const { world, room, marker } = useSelection();
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => setDeleting(null), [room?.id, marker?.x, marker?.y]);

  if (!world || !room) return <Empty icon={<DoorOpen />}>Open a game to connect its rooms.</Empty>;

  const roomId = room.id;
  const exit = marker?.exit === undefined ? undefined : room.exits[marker.exit];
  const ending = marker?.ending;
  const destName = (id: string) => {
    const dest = byId(world.rooms, id);
    return dest ? roomName(dest) : `missing room ${id}`;
  };

  function changeExit(recipe: (exit: Exit, w: World, index: number) => void, group?: string) {
    const index = marker?.exit;
    if (index === undefined) return;
    creator.projects.updateWorld(
      (w) => {
        const target = byId(w.rooms, roomId)?.exits[index];
        if (target) recipe(target, w, index);
      },
      group === undefined ? {} : { group },
    );
  }

  const back = marker?.exit === undefined ? undefined : returnExitOf(world, roomId, marker.exit);
  const backExit = back && byId(world.rooms, back.room)?.exits[back.index];

  function changeBack(recipe: (exit: Exit) => void) {
    if (!back) return;
    creator.projects.updateWorld((w) => {
      const target = byId(w.rooms, back.room)?.exits[back.index];
      if (target) recipe(target);
    });
  }

  const setTransition = (target: Exit, value: string) => {
    if (value) target.transition = value;
    else delete target.transition;
  };

  let roomMap: Uint8ClampedArray | undefined;
  if (exit && marker) {
    roomMap = roomPixels(world, roomId);
    markRoom(roomMap, room, { x: marker.x, y: marker.y });
  }

  const destination = exit && byId(world.rooms, exit.dest.room);
  let destPixels: Uint8ClampedArray | undefined;
  if (exit && destination) {
    destPixels = roomPixels(world, destination.id);
    markRoom(destPixels, destination, exit.dest);
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => creator.editor.set({ roomTool: 'exit' })} aria-pressed={editor.roomTool === 'exit'}>
          <DoorOpen />
          Add an exit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => creator.editor.set({ roomTool: 'ending' })} aria-pressed={editor.roomTool === 'ending'}>
          <Flag />
          Add an ending
        </Button>
      </div>

      {room.exits.length + room.endings.length === 0 ? (
        <p className="text-sm text-muted">
          No exits or endings in {roomName(room)} yet. Pick “Add an exit” or “Add an ending”, then click a cell in the room.
        </p>
      ) : (
        <ul aria-label={`Exits and endings in ${roomName(room)}`} className="space-y-1">
          {room.exits.map((e) => (
            <li key={`exit-${e.x}-${e.y}`}>
              <button
                type="button"
                aria-pressed={marker?.exit !== undefined && marker.x === e.x && marker.y === e.y}
                className={listButton}
                onClick={() => creator.editor.set({ marker: { x: e.x, y: e.y } })}
              >
                <DoorOpen className="text-amber" aria-hidden />
                {`Exit at ${e.x},${e.y} to ${destName(e.dest.room)}`}
              </button>
            </li>
          ))}
          {room.endings.map((e) => (
            <li key={`ending-${e.x}-${e.y}`}>
              <button
                type="button"
                aria-pressed={marker?.ending !== undefined && marker.x === e.x && marker.y === e.y}
                className={listButton}
                onClick={() => creator.editor.set({ marker: { x: e.x, y: e.y } })}
              >
                <Flag className="text-chili" aria-hidden />
                {`Ending at ${e.x},${e.y}`}
              </button>
            </li>
          ))}
        </ul>
      )}

      {exit && marker && (
        <section aria-label="Exit" className="space-y-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Way"
              value={back ? 'both' : 'one'}
              options={ways}
              onChange={(value) => changeExit((_, w, index) => setTwoWay(w, roomId, index, value === 'both'))}
            />
            {!back && (
              <Button
                size="sm"
                variant="ghost"
                title="Lead from the destination to this cell instead"
                onClick={() => {
                  let moved: ReturnType<typeof reverseExit>;
                  changeExit((_, w, index) => void (moved = reverseExit(w, roomId, index)));
                  if (moved) creator.editor.set({ room: moved.room, marker: { x: exit.dest.x, y: exit.dest.y } });
                }}
              >
                <ArrowRightLeft />
                Turn around
              </Button>
            )}
          </div>

          {roomMap && (
            <>
              <PixelCanvas
                label={`Exit in ${roomName(room)}`}
                pixels={roomMap}
                width={ROOM_PIXELS}
                height={ROOM_PIXELS}
                columns={ROOM_SIZE}
                rows={ROOM_SIZE}
                className="w-full max-w-56 shrink-0"
                onPaint={(x, y, first) => {
                  if (!first) return;
                  let moved = false;
                  changeExit((_, w, index) => void (moved = moveExit(w, roomId, index, x, y)));
                  if (moved) creator.editor.set({ marker: { x, y } });
                }}
              />
              <p className="text-[11px] text-muted">Click to move the exit.</p>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Leads to</span>
            <Select
              aria-label="Destination room"
              value={exit.dest.room}
              onChange={(event) => {
                const dest = event.target.value;
                changeExit((target, w, index) => setExitDest(w, roomId, index, { ...target.dest, room: dest }));
              }}
              className="max-w-48"
            >
              {!destination && <option value={exit.dest.room}>{destName(exit.dest.room)}</option>}
              {world.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomName(r)}
                </option>
              ))}
            </Select>
            <span className="tabular-nums">
              at {exit.dest.x},{exit.dest.y}
            </span>
            {destination && destination.id !== roomId && (
              <Button size="sm" variant="ghost" onClick={() => creator.editor.set({ room: destination.id, marker: { x: exit.dest.x, y: exit.dest.y } })}>
                Go to {roomName(destination)}
              </Button>
            )}
          </div>
          {destination && destPixels && (
            <>
              <PixelCanvas
                label={`Destination ${roomName(destination)}`}
                pixels={destPixels}
                width={ROOM_PIXELS}
                height={ROOM_PIXELS}
                columns={ROOM_SIZE}
                rows={ROOM_SIZE}
                className="w-full max-w-56 shrink-0"
                onPaint={(x, y, first) => {
                  if (first) changeExit((target, w, index) => setExitDest(w, roomId, index, { room: target.dest.room, x, y }));
                }}
              />
              <p className="text-[11px] text-muted">Click where the avatar arrives.</p>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Transition</span>
            <TransitionSelect label="Transition" value={exit.transition} onChange={(value) => changeExit((target) => setTransition(target, value))} />
            {backExit && (
              <>
                <span>Way back</span>
                <TransitionSelect label="Transition on the way back" value={backExit.transition} onChange={(value) => changeBack((target) => setTransition(target, value))} />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            {exit.dialog !== undefined ? (
              <>
                <Textarea
                  aria-label="Exit dialog"
                  value={dialogText(world, exit.dialog) ?? ''}
                  className="min-h-20 font-mono text-xs"
                  onChange={(event) => {
                    const value = event.target.value;
                    const id = exit.dialog!;
                    creator.projects.updateWorld((w) => setDialogText(w, id, value), { group: `exit-dialog-${id}` });
                  }}
                  onBlur={() => creator.projects.endGroup()}
                />
                <p className="text-[11px] text-muted">Runs when the avatar goes through. {'{property locked true}'} keeps the door shut.</p>
                <Button size="sm" variant="ghost" onClick={() => changeExit((_, w, index) => void setExitDialog(w, roomId, index, null))}>
                  <Trash2 />
                  Remove exit dialog
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="secondary" onClick={() => changeExit((_, w, index) => void setExitDialog(w, roomId, index, 'narration'))}>
                  <MessageSquare />
                  Add narration
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  title={world.items.length ? 'The door opens for a player who has the key' : 'Make an item to use as the key first'}
                  disabled={world.items.length === 0}
                  onClick={() => changeExit((_, w, index) => void setExitDialog(w, roomId, index, 'lock'))}
                >
                  <Lock />
                  Add a lock
                </Button>
              </div>
            )}
          </div>

          {deleting === 'exit' ? (
            <Confirm
              question={back ? 'Delete this exit and its way back?' : 'Delete this exit?'}
              onKeep={() => setDeleting(null)}
              onDelete={() => {
                creator.projects.updateWorld((w) => void removeExit(w, roomId, marker.x, marker.y));
                setDeleting(null);
                creator.editor.set({ marker: null });
              }}
            />
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setDeleting('exit')}>
              <Trash2 />
              Remove exit
            </Button>
          )}
        </section>
      )}

      {ending !== undefined && marker && (
        <section aria-label="Ending" className="flex flex-col gap-2 border-t border-line pt-3">
          <Textarea
            aria-label="Ending text"
            value={dialogText(world, ending) ?? ''}
            className={cn('min-h-24')}
            onChange={(event) => {
              const value = event.target.value;
              creator.projects.updateWorld((w) => setDialogText(w, ending, value), { group: `ending-${ending}` });
            }}
            onBlur={() => creator.projects.endGroup()}
          />
          <p className="text-[11px] text-muted">The game ends after this text.</p>
          {deleting === 'ending' ? (
            <Confirm
              question="Delete this ending and its text?"
              onKeep={() => setDeleting(null)}
              onDelete={() => {
                creator.projects.updateWorld((w) => void removeEndingAt(w, roomId, marker.x, marker.y));
                setDeleting(null);
                creator.editor.set({ marker: null });
              }}
            />
          ) : (
            <Button size="sm" variant="ghost" className="w-fit" onClick={() => setDeleting('ending')}>
              <Trash2 />
              Remove ending
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

export default defineTool({
  id: 'exits',
  title: 'Exits & endings',
  icon: DoorOpen,
  component: ExitsTool,
  defaultPosition: 'within',
  defaultReference: 'dialog',
  openByDefault: true,
  openInBackground: true,
});
