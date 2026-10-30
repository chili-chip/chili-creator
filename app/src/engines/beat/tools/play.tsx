import { Gamepad2, Play as PlayIcon, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { BEAT_BUTTONS, loadEngine, type BeatPlayer } from '../player';
import { selectionOf, useGame } from '../state';

const touch = [
  ['up', '▲'],
  ['left', '◀'],
  ['down', '▼'],
  ['right', '▶'],
  ['a', 'A'],
  ['b', 'B'],
] as const;

function Play() {
  const creator = useCreator();
  const game = useGame();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const player = useRef<BeatPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  function stop() {
    player.current?.stop();
    setPlaying(false);
    selectionOf(creator).set({ lit: [] });
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
    // Rule trace: light the cards that ran in the last quarter second.
    let lit = new Set<number>();
    let shown = 0;
    engine.onStep = (debug) => {
      debug.fired.forEach((rule) => lit.add(rule));
      if (++shown % 15 === 0) {
        selectionOf(creator).set({ lit: [...lit] });
        lit = new Set();
      }
    };
    engine.muted = muted;
    engine.start(canvas.current!, { keys: canvas.current! });
    canvas.current!.focus();
    setPlaying(true);
  }

  useEffect(() => () => player.current?.stop(), []);
  if (!game) return <Empty icon={<Gamepad2 />}>Open a Chili Beat game to play it.</Empty>;

  return (
    <div className="flex h-full flex-col items-center gap-2 overflow-auto p-3 text-xs">
      <div className="flex gap-1">
        {playing ? (
          <Button size="sm" onClick={stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => void play()}>
            <PlayIcon /> Play
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
        aria-label="Game screen. Arrows move, Z is A, X is B."
        width={128}
        height={128}
        className="aspect-square w-full max-w-[512px] min-w-32 bg-black [image-rendering:pixelated] focus:outline-2 focus:outline-phosphor"
      />
      {error && (
        <p role="alert" className="max-w-[512px] text-chili">
          This game can't play yet: {error}
        </p>
      )}
      <div aria-label="Touch buttons" className="grid grid-cols-6 gap-1">
        {touch.map(([button, label]) => (
          <Button
            key={button}
            size="sm"
            variant="secondary"
            aria-label={button}
            onPointerDown={() => player.current?.press(BEAT_BUTTONS[button], true)}
            onPointerUp={() => player.current?.press(BEAT_BUTTONS[button], false)}
            onPointerLeave={() => player.current?.press(BEAT_BUTTONS[button], false)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-muted">Arrows or WASD move. Z or Space is A, X is B. Click the screen first.</p>
    </div>
  );
}

export default defineTool({
  id: 'beat-play',
  title: 'Play',
  icon: Gamepad2,
  help: 'Play your game. The rule cards that just ran light up in Rules.',
  component: Play,
  defaultPosition: 'below',
  defaultReference: 'beat-screens',
  openByDefault: true,
  openInBackground: true,
});
