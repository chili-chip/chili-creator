import { Eraser, Map as MapIcon, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Checkbox, Input, Select } from '../../../ui/input';
import { PixelCanvas } from '../../../ui/pixel-canvas';
import { Segmented } from '../../../ui/segmented';
import { addScreen, deleteScreen, paintCell, screenAt } from '../edit';
import type { Game } from '../model';
import { boardRGBA } from '../render';
import { useGame, useSelection, useUpdate } from '../state';
import { ThingImage } from './things';

const ERASER = '.';

/** The 8 × 8 world map: pick a screen, or add one in an empty place. */
function WorldMap({ game, current, onPick, onAdd }: { game: Game; current: string; onPick(id: string): void; onAdd(x: number, y: number): void }) {
  return (
    <div role="grid" aria-label="Screen map" className="grid w-fit grid-cols-8 gap-0.5">
      {Array.from({ length: 64 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const screen = screenAt(game, x, y);
        return screen ? (
          <button
            key={i}
            type="button"
            aria-label={`Screen ${screen.id}`}
            aria-pressed={screen.id === current}
            title={screen.id === game.start ? `${screen.id} (start)` : screen.id}
            onClick={() => onPick(screen.id)}
            className="size-5 rounded-sm border border-line bg-bg-3 aria-pressed:border-chili aria-pressed:bg-chili/40"
          >
            {screen.id === game.start && <span className="text-[9px]">★</span>}
          </button>
        ) : (
          <button
            key={i}
            type="button"
            aria-label={`Add a screen at ${x}, ${y}`}
            title="Add a screen here"
            onClick={() => onAdd(x, y)}
            className="size-5 rounded-sm border border-dashed border-muted/40 hover:border-chili"
          />
        );
      })}
    </div>
  );
}

function Screens() {
  const { projects } = useCreator();
  const game = useGame();
  const update = useUpdate();
  const selection = useSelection(game);
  const [brush, setBrush] = useState<string>('');
  const [error, setError] = useState('');
  const screen = selection.screen;
  const pixels = useMemo(() => (game && screen ? boardRGBA(game, screen) : new Uint8ClampedArray(128 * 128 * 4)), [game, screen]);
  if (!game || !screen) return <Empty icon={<MapIcon />}>Open a Chili Beat game to build its screens.</Empty>;
  const paintWith = brush || selection.thing?.key || ERASER;

  function edit(recipe: (game: Game) => void, group?: string) {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Layer"
            value={selection.layer}
            options={[
              { value: 'things', label: 'Things' },
              { value: 'ground', label: 'Ground' },
            ]}
            onChange={(layer) => selection.set({ layer })}
          />
          <div role="radiogroup" aria-label="Brush" className="flex flex-wrap gap-1">
            {game.things.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={paintWith === t.key}
                aria-label={t.name}
                title={t.name}
                onClick={() => {
                  setBrush('');
                  selection.set({ thing: t.key });
                }}
                className="rounded border-2 border-line p-0.5 aria-checked:border-phosphor"
              >
                <ThingImage game={game} thing={t} className="size-5" />
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={paintWith === ERASER}
              aria-label="Eraser"
              title="Eraser"
              onClick={() => setBrush(ERASER)}
              className="grid size-7 place-items-center rounded border-2 border-line aria-checked:border-phosphor"
            >
              <Eraser className="size-4" />
            </button>
          </div>
        </div>
        <PixelCanvas
          label={`Screen ${screen.id}, ${selection.layer} layer`}
          pixels={pixels}
          width={128}
          height={128}
          columns={16}
          rows={16}
          className="aspect-square w-full max-w-[512px]"
          onPaint={(x, y) => edit((g) => paintCell(g, screen.id, selection.layer, x, y, paintWith), `paint-${screen.id}`)}
          onStrokeEnd={() => projects.endGroup()}
        />
        {error && (
          <p role="alert" className="text-chili">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 lg:w-56">
        <WorldMap
          game={game}
          current={screen.id}
          onPick={(id) => selection.set({ screen: id })}
          onAdd={(x, y) => edit((g) => selection.set({ screen: addScreen(g, x, y).id }))}
        />
        <label className="flex flex-col gap-1">
          Screen name
          <Input
            aria-label="Screen name"
            value={screen.id}
            onChange={(event) => {
              const id = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16);
              if (!id || game.screens.some((s) => s.id === id)) return;
              edit((g) => {
                const s = g.screens.find((x) => x.id === screen.id)!;
                for (const rule of g.rules) for (const action of rule.do) if ('go' in action && action.go === s.id) action.go = id;
                if (g.start === s.id) g.start = id;
                s.id = id;
              }, `rename-${screen.id}`);
              selection.set({ screen: id });
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          Tune
          <Select
            aria-label="Tune"
            value={screen.tune ?? ''}
            onChange={(event) =>
              edit((g) => {
                const s = g.screens.find((x) => x.id === screen.id)!;
                if (event.target.value) s.tune = event.target.value;
                else delete s.tune;
              })
            }
          >
            <option value="">No tune</option>
            {(game.tunes ?? []).map((tune) => (
              <option key={tune.id} value={tune.id}>
                {tune.id}
              </option>
            ))}
          </Select>
        </label>
        <Checkbox
          label="Reset when you come back"
          checked={Boolean(screen.reset)}
          onChange={(event) =>
            edit((g) => {
              const s = g.screens.find((x) => x.id === screen.id)!;
              if (event.target.checked) s.reset = true;
              else delete s.reset;
            })
          }
        />
        <div className="flex gap-1">
          <Button size="sm" disabled={game.start === screen.id} onClick={() => edit((g) => void (g.start = screen.id))}>
            <Plus /> Start here
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete screen ${screen.id}`}
            onClick={() => {
              edit((g) => deleteScreen(g, screen.id));
              selection.set({ screen: null });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </section>
    </div>
  );
}

export default defineTool({
  id: 'beat-screens',
  title: 'Screens',
  icon: MapIcon,
  help: 'Paint things and ground on each 16 by 16 screen, and lay out screens on the world map. Walk off an edge to reach the screen next to it.',
  component: Screens,
  openByDefault: true,
});
