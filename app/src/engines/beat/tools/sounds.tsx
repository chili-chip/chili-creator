import { AudioLines, Play as PlayIcon, Plus, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/cn';
import { Input, Select } from '../../../ui/input';
import type { Blip, Game, Tune } from '../model';
import { loadEngine, type BeatPlayer } from '../player';
import { addBlip, addTune, previewGame, renameBlip, renameTune, setStep } from '../sound';
import { useGame, useUpdate } from '../state';

const PRESETS: Blip['preset'][] = ['coin', 'jump', 'hit', 'boom', 'step', 'power', 'blip'];
const SCALES: [Tune['scale'], string][] = [
  ['major', 'Major (bright)'],
  ['minor', 'Minor (dark)'],
  ['pentatonic-major', 'Pentatonic major (happy)'],
  ['pentatonic-minor', 'Pentatonic minor (bluesy)'],
];
const LEAD_ROWS = Array.from({ length: 15 }, (_, i) => 15 - i);
const BEAT_ROWS: [number, string][] = [
  [10, 'Hi-hat'],
  [9, 'Snare'],
  [8, 'Kick'],
  ...Array.from({ length: 7 }, (_, i) => [7 - i, `Bass ${7 - i}`] as [number, string]),
];

const cleanId = (text: string) => text.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16);

/** Plays previews with the real engine, so they sound like the game. */
function usePreview() {
  const player = useRef<BeatPlayer | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState<string | null>(null);

  function stop() {
    window.clearTimeout(timer.current);
    player.current?.stop();
    setPlaying(null);
  }

  async function play(game: Game, what: { blip?: string; tune?: string }) {
    stop();
    const engine = (player.current ??= await loadEngine());
    canvas.current ??= document.createElement('canvas');
    if (engine.load(previewGame(game, what))) return;
    engine.enableSound();
    engine.start(canvas.current, { keys: canvas.current });
    setPlaying(what.blip ?? what.tune ?? null);
    if (what.blip) timer.current = window.setTimeout(stop, 1500);
  }

  useEffect(() => stop, []);
  return { play, stop, playing };
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-12 text-muted">{label}</span>
      <input aria-label={label} type="range" min={0} max={7} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-24 accent-chili" />
    </label>
  );
}

function Grid({ label, rows, steps, onSet }: { label: string; rows: [number, string][]; steps: number[]; onSet(step: number, value: number): void }) {
  return (
    <div role="grid" aria-label={label} className="inline-grid gap-px" style={{ gridTemplateColumns: `4rem repeat(16, 1.25rem)` }}>
      {rows.map(([value, name]) => (
        <div role="row" key={value} className="contents">
          <span role="rowheader" className="pr-1 text-right text-[10px] text-muted">
            {name}
          </span>
          {steps.map((current, step) => (
            <button
              key={step}
              type="button"
              role="gridcell"
              aria-label={`${name}, step ${step + 1}`}
              aria-selected={current === value}
              onClick={() => onSet(step, value)}
              className={cn(
                'h-4 rounded-sm border border-line/60 bg-bg-0 aria-selected:border-phosphor aria-selected:bg-phosphor',
                step % 4 === 0 && 'bg-bg-3',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Sounds() {
  const game = useGame();
  const update = useUpdate();
  const preview = usePreview();
  const [tuneId, setTuneId] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!game) return <Empty icon={<AudioLines />}>Open a Chili Beat game to make its sounds.</Empty>;
  const tune = game.tunes?.find((t) => t.id === tuneId) ?? game.tunes?.[0];

  function edit(recipe: (game: Game) => void, group?: string) {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-3 text-xs">
      <section className="space-y-2">
        <h3 className="font-semibold">Sound effects</h3>
        <ul aria-label="Sound effects" className="space-y-2">
          {(game.blips ?? []).map((blip, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-line p-2">
              <Input
                aria-label="Sound name"
                className="w-24"
                value={blip.id}
                onChange={(event) => {
                  const id = cleanId(event.target.value);
                  if (id && id !== blip.id && !game.blips!.some((b) => b.id === id)) edit((g) => renameBlip(g, blip.id, id), `blip-name-${i}`);
                }}
              />
              <Select aria-label={`${blip.id} preset`} value={blip.preset} onChange={(event) => edit((g) => void (g.blips![i]!.preset = event.target.value as Blip['preset']))}>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              <Slider label="Pitch" value={blip.pitch ?? 4} onChange={(v) => edit((g) => void (g.blips![i]!.pitch = v), `blip-${i}`)} />
              <Slider label="Length" value={blip.length ?? 3} onChange={(v) => edit((g) => void (g.blips![i]!.length = v), `blip-${i}`)} />
              <Slider label="Slide" value={blip.slide ?? 0} onChange={(v) => edit((g) => void (g.blips![i]!.slide = v), `blip-${i}`)} />
              <Button size="sm" variant="ghost" aria-label={`Play ${blip.id}`} onClick={() => void preview.play(game, { blip: blip.id })}>
                <PlayIcon />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Delete ${blip.id}`} onClick={() => edit((g) => void g.blips!.splice(i, 1))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => edit((g) => void addBlip(g))}>
          <Plus /> Add sound
        </Button>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Tunes</h3>
        <div className="flex flex-wrap items-center gap-2">
          {tune && (
            <Select aria-label="Tune" value={tune.id} onChange={(event) => setTuneId(event.target.value)}>
              {game.tunes!.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </Select>
          )}
          <Button
            size="sm"
            onClick={() =>
              edit((g) => {
                setTuneId(addTune(g).id);
              })
            }
          >
            <Plus /> Add tune
          </Button>
        </div>
        {tune && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Tune name"
                className="w-24"
                value={tune.id}
                onChange={(event) => {
                  const id = cleanId(event.target.value);
                  if (id && id !== tune.id && !game.tunes!.some((t) => t.id === id)) {
                    edit((g) => renameTune(g, tune.id, id), `tune-name`);
                    setTuneId(id);
                  }
                }}
              />
              <Select aria-label="Scale" value={tune.scale} onChange={(event) => edit((g) => void (g.tunes!.find((t) => t.id === tune.id)!.scale = event.target.value as Tune['scale']))}>
                {SCALES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {preview.playing === tune.id ? (
                <Button size="sm" onClick={preview.stop}>
                  <Square /> Stop
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => void preview.play(game, { tune: tune.id })}>
                  <PlayIcon /> Play tune
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label={`Delete ${tune.id}`} onClick={() => edit((g) => void (g.tunes = g.tunes!.filter((t) => t.id !== tune.id)))}>
                <Trash2 />
              </Button>
            </div>
            <p className="text-muted">One step plays on each beat. Notes come from the scale, so any pattern stays in key.</p>
            <div className="overflow-x-auto">
              <Grid label="Melody" rows={LEAD_ROWS.map((n) => [n, `Note ${n}`])} steps={tune.lead} onSet={(step, value) => edit((g) => setStep(g, tune.id, 'lead', step, value))} />
            </div>
            <div className="overflow-x-auto">
              <Grid label="Bass and drums" rows={BEAT_ROWS} steps={tune.beat} onSet={(step, value) => edit((g) => setStep(g, tune.id, 'beat', step, value))} />
            </div>
            <p className="text-muted">Give a screen this tune in Screens.</p>
          </>
        )}
      </section>
      {error && (
        <p role="alert" className="text-chili">
          {error}
        </p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'beat-sounds',
  title: 'Sounds',
  icon: AudioLines,
  help: 'Sound effects that rules play, and 16-step tunes that play on the beat of each screen.',
  component: Sounds,
});
