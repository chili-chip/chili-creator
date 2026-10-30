import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Circle,
  CirclePlay,
  ImageUp,
  Play as PlayIcon,
  RotateCcw,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { download, fileName } from '../../export/files';
import { encodeGif } from '../../export/gif';
import { encodePng, pngDataUrl } from '../../export/png';
import { createRecorder, type Recorder } from '../../export/recorder';
import { defineTool } from '../../plugin-api';
import { drawingName, type World } from '../../bitsy';
import { Button as Key, buttonForKey, type GameState, type Player, type PlayerState } from '../../player';
import { useCreator, useProjects } from '../../shell/creator-context';
import { Button } from '../../ui/button';

const SIZE = 128;

/** The latest frame, for pictures, and a call when the first one comes. */
interface Shot {
  pixels: Uint8ClampedArray | null;
  onFirst(): void;
}

// Reads the ref on every frame: the canvas mounts only once a game is open.
function paintInto(canvas: RefObject<HTMLCanvasElement | null>, recorder: Recorder, shot: Shot) {
  let image: ImageData | null = null;
  return (pixels: Uint8ClampedArray) => {
    recorder.frame(pixels);
    if (!shot.pixels) {
      shot.pixels = new Uint8ClampedArray(pixels);
      shot.onFirst();
    } else shot.pixels.set(pixels);
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    image ??= context.createImageData(SIZE, SIZE);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  };
}

function usePlayer(canvas: RefObject<HTMLCanvasElement | null>, recorder: Recorder, shot: Shot) {
  const creator = useCreator();
  const [player, setPlayer] = useState<Player | null>(null);
  const [state, setState] = useState<PlayerState>({ status: 'idle' });
  useEffect(() => {
    const created = creator.createPlayer(paintInto(canvas, recorder, shot));
    setPlayer(created);
    const unsubscribe = created.subscribe(setState);
    return () => {
      unsubscribe();
      created.dispose();
    };
  }, [creator, canvas, recorder, shot]);
  return { player, state };
}

function useGameState(player: Player | null): GameState | null {
  const [state, setState] = useState<GameState | null>(() => player?.gameState() ?? null);
  useEffect(() => {
    setState(player?.gameState() ?? null);
    return player?.subscribeGameState(setState);
  }, [player]);
  return state;
}

function StateTable({ caption, empty, rows }: { caption: string; empty: string; rows: [string, string][] }) {
  return (
    <table className="w-full text-left text-xs">
      <caption className="pb-1 text-left text-xs font-semibold tracking-wide text-muted uppercase">{caption}</caption>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="text-muted">{empty}</td>
          </tr>
        ) : (
          rows.map(([name, value]) => (
            <tr key={name} className="border-t border-line">
              <th scope="row" className="py-1 pr-2 font-normal text-text">
                {name}
              </th>
              <td className="py-1 text-right font-mono text-text tabular-nums">{value}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/** The running game's inventory and variables, as the classic editor showed them. */
function LiveState({ world, state }: { world: World; state: GameState }) {
  const items = world.items.map((item): [string, string] => [
    drawingName('items', item),
    String(state.inventory[item.id] ?? 0),
  ]);
  const variables = Object.entries(state.variables)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]): [string, string] => [name, JSON.stringify(value)]);
  return (
    <div className="mx-auto grid w-full max-w-[min(100%,512px)] gap-4 sm:grid-cols-2">
      <StateTable caption="Inventory" empty="No items in this game." rows={items} />
      <StateTable caption="Variables" empty="No variables in this game." rows={variables} />
    </div>
  );
}

function TouchButton({ label, button, player, children }: { label: string; button: Key; player: Player | null; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-12 touch-none place-items-center rounded-lg border border-line bg-bg-3 text-text select-none active:bg-chili active:text-on-accent [&_svg]:size-5"
      onPointerDown={(event) => {
        event.preventDefault();
        player?.press(button, true);
      }}
      onPointerUp={() => player?.press(button, false)}
      onPointerLeave={() => player?.press(button, false)}
      onPointerCancel={() => player?.press(button, false)}
    >
      {children}
    </button>
  );
}

function Play() {
  const creator = useCreator();
  const projects = useProjects();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const screen = useRef<HTMLDivElement | null>(null);
  const [recorder] = useState(() => createRecorder());
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasPicture, setHasPicture] = useState(false);
  const [shot] = useState<Shot>(() => ({ pixels: null, onFirst: () => setHasPicture(true) }));
  const { player, state } = usePlayer(canvas, recorder, shot);
  const gameState = useGameState(player);
  const ready = projects.open.status === 'ready';
  const running = state.status === 'playing' || state.status === 'loading';

  function stopRecording() {
    if (!recorder.recording()) return;
    const frames = recorder.stop();
    setRecording(false);
    if (frames.length === 0) return;
    download(fileName(title(), 'gif'), encodeGif(frames, { scale: 2 }), 'image/gif');
  }

  function title() {
    return projects.open.status === 'ready' ? (projects.open.world.title.split('\n')[0] ?? '') : '';
  }

  function picture(scale: number) {
    return encodePng(shot.pixels!, SIZE, SIZE, { scale });
  }

  async function useAsCover() {
    try {
      await creator.projects.setCover(pngDataUrl(picture(2)));
      creator.notify('success', 'Cover set.');
    } catch (err) {
      creator.notify('error', `Could not set the cover: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A recording ends with the game, or at its longest.
  useEffect(() => {
    if (!recording) return;
    if (!running) {
      stopRecording();
      return;
    }
    const timer = setInterval(() => {
      setElapsed(recorder.elapsedMs());
      if (recorder.full()) stopRecording();
    }, 500);
    return () => clearInterval(timer);
  });

  function start() {
    player?.play(creator.projects.data());
    screen.current?.focus();
  }

  // A different game was opened: stop the old one.
  const openId = projects.open.status === 'ready' ? projects.open.project.id : null;
  useEffect(() => {
    player?.stop();
  }, [player, openId]);

  function onKey(event: KeyboardEvent, down: boolean) {
    const button = buttonForKey(event.key);
    if (button === undefined || !running) return;
    event.preventDefault();
    if (!event.repeat) player?.press(button, down);
  }

  if (!ready) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
        <div className="space-y-2">
          <CirclePlay className="mx-auto size-8" aria-hidden />
          <p>Open a game to play it.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-play-panel className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" onClick={() => player?.stop()}>
            <Square />
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={start}>
            <PlayIcon />
            Play game
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={start} disabled={!running}>
          <RotateCcw />
          Restart
        </Button>
        {running &&
          (recording ? (
            <Button size="sm" variant="destructive" onClick={stopRecording}>
              <Circle className="fill-current" />
              Stop recording
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              title="Records up to 30 seconds as a GIF"
              onClick={() => {
                recorder.start();
                setElapsed(0);
                setRecording(true);
                screen.current?.focus();
              }}
            >
              <Circle />
              Record GIF
            </Button>
          ))}
        {recording && (
          <progress
            aria-label="Recording"
            className="h-2 w-20 accent-chili"
            max={recorder.maxMs / 1000}
            value={Math.floor(elapsed / 1000)}
            title={`${Math.floor(elapsed / 1000)} of ${recorder.maxMs / 1000} seconds`}
          />
        )}
        {hasPicture && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => download(fileName(title(), 'png'), picture(4), 'image/png')}
            >
              <Camera />
              Save picture
            </Button>
            <Button size="sm" variant="ghost" title="Show this picture with your game on the platform" onClick={useAsCover}>
              <ImageUp />
              Use as cover
            </Button>
          </>
        )}
        <span className="ml-auto text-xs text-muted">
          {state.status === 'loading' && 'Starting…'}
          {state.status === 'playing' && 'Arrows or WASD to move, Space to talk'}
          {state.status === 'ended' && 'The end.'}
        </span>
      </div>

      {/* The space left under the toolbar. The screen is the largest square that fits in it,
          so it stays square whatever shape the panel has (#40). It never gets shorter than the
          game's own 128 px: in a short panel the panel scrolls instead. */}
      <div className="flex min-h-32 flex-1 items-center justify-center [container-type:size]">
        <div
          ref={screen}
          role="application"
          aria-label="Game screen"
          tabIndex={0}
          className="relative size-[min(100cqw,100cqh,512px)] shrink-0 overflow-hidden rounded-lg border border-line bg-black focus-visible:outline-2 focus-visible:outline-phosphor"
          onKeyDown={(event) => onKey(event, true)}
          onKeyUp={(event) => onKey(event, false)}
          onPointerDown={() => running && player?.tap()}
        >
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            className="size-full object-contain [image-rendering:pixelated]"
          />
          {!running && state.status !== 'ended' && (
            <button
              type="button"
              onClick={start}
              className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-text"
              tabIndex={-1}
              aria-hidden
            >
              <span className="flex items-center gap-2">
                <PlayIcon className="size-5" /> Play
              </span>
            </button>
          )}
        </div>
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-chili">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-center gap-6 pointer-fine:hidden" aria-label="Touch controls">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <TouchButton label="Up" button={Key.Up} player={player}>
            <ArrowUp />
          </TouchButton>
          <span />
          <TouchButton label="Left" button={Key.Left} player={player}>
            <ArrowLeft />
          </TouchButton>
          <span />
          <TouchButton label="Right" button={Key.Right} player={player}>
            <ArrowRight />
          </TouchButton>
          <span />
          <TouchButton label="Down" button={Key.Down} player={player}>
            <ArrowDown />
          </TouchButton>
          <span />
        </div>
        <TouchButton label="Ok" button={Key.Ok} player={player}>
          <span className="font-pixel text-[10px]">A</span>
        </TouchButton>
      </div>

      {gameState && state.status !== 'idle' && projects.open.status === 'ready' && (
        <LiveState world={projects.open.world} state={gameState} />
      )}
    </div>
  );
}

export default defineTool({
  id: 'play',
  title: 'Play',
  help: 'Play the game as it is now, record a GIF, save a picture or set the cover.',
  icon: PlayIcon,
  component: Play,
  defaultPosition: 'within',
  defaultReference: 'paint',
  openByDefault: true,
  openInBackground: true,
});
