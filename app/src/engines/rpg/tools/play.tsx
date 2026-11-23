import { Gamepad2, Play as PlayIcon, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { loadEngine, RPG_BUTTONS, type RpgDebug, type RpgPlayer } from '../player';
import { useGame } from '../state';

const touch = [
  ['up', '▲'],
  ['left', '◀'],
  ['down', '▼'],
  ['right', '▶'],
  ['a', 'A'],
  ['b', 'B'],
  ['x', 'X'],
  ['y', 'Y'],
] as const;

/** One line about the hero, for finding bugs while you play. */
function status(debug: RpgDebug): string {
  const parts = [`${debug.room} ${debug.x}, ${debug.y}`, `HP ${debug.hp}/${debug.stats.max_hp ?? '?'}`, `level ${debug.level}`];
  const quests = Object.entries(debug.quests).map(([id, stage]) => `${id} ${stage === 'done' ? 'done' : `stage ${stage}`}`);
  if (quests.length) parts.push(quests.join(', '));
  if (debug.flags.length) parts.push(`flags: ${debug.flags.join(', ')}`);
  if (debug.state !== 'playing') parts.push(debug.state === 'won' ? 'won' : 'lost');
  return parts.join(' · ');
}

function Play() {
  const creator = useCreator();
  const game = useGame();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const player = useRef<RpgPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [line, setLine] = useState('');

  function stop() {
    player.current?.stop();
    setPlaying(false);
  }

  async function play() {
    setError('');
    const engine = (player.current ??= await loadEngine());
    const problem = engine.load(creator.projects.data());
    if (problem) {
      setError(problem);
      setPlaying(false);
      return;
    }
    // A quarter of a second between updates is plenty to read.
    let steps = 0;
    engine.onStep = (debug) => {
      if (++steps % 15 === 0) setLine(status(debug));
    };
    engine.muted = muted;
    engine.start(canvas.current!, { keys: canvas.current! });
    engine.enableSound();
    canvas.current!.focus();
    setPlaying(true);
  }

  useEffect(() => () => player.current?.stop(), []);
  if (!game) return <Empty icon={<Gamepad2 />}>Open a Chili RPG game to play it.</Empty>;

  return (
    <div className="flex h-full flex-col items-center gap-2 overflow-auto p-3 text-xs">
      <div className="flex gap-1">
        {playing ? (
          <Button size="sm" onClick={stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => void play()}>
            <PlayIcon /> Play game
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!playing} onClick={() => void play()}>
          <RotateCcw /> Restart with my changes
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={muted ? 'Sound on' : 'Sound off'}
          onClick={() => {
            setMuted(!muted);
            if (player.current) player.current.muted = !muted;
          }}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Game screen. Arrows move, Z is A, X is B, C is the bag, V is quests."
        width={128}
        height={128}
        className="aspect-square w-full max-w-[512px] min-w-32 bg-black [image-rendering:pixelated] focus:outline-2 focus:outline-phosphor"
      />
      {playing && line && (
        <p aria-label="Game state" className="max-w-[512px] text-center font-mono text-muted">
          {line}
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-[512px] text-chili">
          This game can't play yet: {error}
        </p>
      )}
      <div aria-label="Touch buttons" className="grid grid-cols-8 gap-1">
        {touch.map(([button, label]) => (
          <Button
            key={button}
            size="sm"
            variant="secondary"
            aria-label={button}
            onPointerDown={() => player.current?.press(RPG_BUTTONS[button], true)}
            onPointerUp={() => player.current?.press(RPG_BUTTONS[button], false)}
            onPointerLeave={() => player.current?.press(RPG_BUTTONS[button], false)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-muted">Arrows or WASD walk. Z or Space is A, X is B, C opens the bag, V the quests. Click the screen first.</p>
    </div>
  );
}

export default defineTool({
  id: 'rpg-play',
  title: 'Play',
  icon: Gamepad2,
  help: 'Play your game from the start. The line under the screen shows the room, HP, quests and flags.',
  component: Play,
  defaultPosition: 'below',
  defaultReference: 'rpg-rooms',
  openByDefault: true,
  openInBackground: true,
});
