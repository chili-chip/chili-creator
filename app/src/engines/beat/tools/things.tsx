import { Copy, Layers, Plus, Shapes, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Button } from '../../../ui/button';
import { Checkbox, Input } from '../../../ui/input';
import { PixelCanvas, PixelImage } from '../../../ui/pixel-canvas';
import { Empty } from '../../../tools/shared';
import { addThing, deleteThing, renameThingKey, setPixel } from '../edit';
import type { Game, Thing } from '../model';
import { cssColour, pictureRGBA } from '../render';
import { useGame, useSelection, useUpdate } from '../state';

export function ThingImage({ game, thing, className = 'size-8' }: { game: Game; thing: Thing; className?: string }) {
  const pixels = useMemo(() => pictureRGBA(game, thing.frames[0]!), [game, thing]);
  return <PixelImage pixels={pixels} width={8} height={8} className={className} />;
}

/** The drawing, with the other frame showing faintly behind it. */
function drawing(game: Game, thing: Thing, frame: number, onion: boolean): Uint8ClampedArray {
  const pixels = pictureRGBA(game, thing.frames[frame]!);
  const other = thing.frames[1 - frame];
  if (!onion || !other) return pixels;
  const ghost = pictureRGBA(game, other, true);
  const mine = thing.frames[frame]!;
  for (let i = 0; i < 64; i++) {
    if (mine[Math.floor(i / 8)]![i % 8] === '0' && ghost[i * 4 + 3]) {
      for (let c = 0; c < 3; c++) pixels[i * 4 + c] = (pixels[i * 4 + c]! + ghost[i * 4 + c]!) / 2;
    }
  }
  return pixels;
}

function Things() {
  const { projects } = useCreator();
  const game = useGame();
  const update = useUpdate();
  const selection = useSelection(game);
  const [colour, setColour] = useState(1);
  const [onion, setOnion] = useState(true);
  const [error, setError] = useState('');
  if (!game) return <Empty icon={<Shapes />}>Open a Chili Beat game to draw its things.</Empty>;
  const thing = selection.thing!;
  const frame = selection.frame;

  function edit(recipe: (game: Game) => void, group?: string) {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-2 sm:w-44">
        <ul aria-label="Things" className="grid grid-cols-4 gap-1 sm:grid-cols-3">
          {game.things.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                aria-label={t.name}
                aria-pressed={t.key === thing.key}
                title={`${t.name} (${t.key})`}
                onClick={() => selection.set({ thing: t.key, frame: 0 })}
                className="grid w-full place-items-center rounded border border-line p-1 aria-pressed:border-chili"
              >
                <ThingImage game={game} thing={t} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() =>
              edit((g) => {
                selection.set({ thing: addThing(g).key, frame: 0 });
              })
            }
          >
            <Plus /> Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${thing.name}`}
            onClick={() => edit((g) => deleteThing(g, thing.key))}
          >
            <Trash2 />
          </Button>
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Thing name"
            value={thing.name}
            maxLength={16}
            onChange={(event) => edit((g) => void (g.things.find((t) => t.key === thing.key)!.name = event.target.value), `name-${thing.key}`)}
          />
          <Input
            aria-label="Key"
            title="The character this thing uses in the file"
            className="w-10 text-center font-mono"
            value={thing.key}
            maxLength={1}
            onChange={(event) => {
              const key = event.target.value;
              if (key.length === 1 && key !== '.' && key !== ' ' && key !== thing.key) {
                edit((g) => renameThingKey(g, thing.key, key));
                selection.set({ thing: key });
              }
            }}
          />
          <Checkbox
            label="Is you"
            checked={Boolean(thing.you)}
            onChange={(event) =>
              edit((g) => {
                const t = g.things.find((x) => x.key === thing.key)!;
                if (event.target.checked) t.you = true;
                else delete t.you;
              })
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Colour" className="flex gap-1">
            {[0, 1, 2, 3].map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={colour === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColour(c)}
                style={{ background: cssColour(game, c) }}
                className="size-7 rounded border-2 border-line aria-checked:border-phosphor"
              />
            ))}
          </div>
          <div role="radiogroup" aria-label="Frame" className="flex gap-1">
            {thing.frames.map((_, i) => (
              <Button key={i} size="sm" variant={frame === i ? 'primary' : 'secondary'} role="radio" aria-checked={frame === i} onClick={() => selection.set({ frame: i })}>
                Frame {i + 1}
              </Button>
            ))}
          </div>
          {thing.frames.length === 1 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                edit((g) => {
                  const t = g.things.find((x) => x.key === thing.key)!;
                  t.frames.push([...t.frames[0]!]);
                  selection.set({ frame: 1 });
                })
              }
            >
              <Copy /> Add frame 2
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  edit((g) => void g.things.find((x) => x.key === thing.key)!.frames.splice(1, 1));
                  selection.set({ frame: 0 });
                }}
              >
                <Trash2 /> Remove frame 2
              </Button>
              <Checkbox label="Onion skin" checked={onion} onChange={(event) => setOnion(event.target.checked)} />
            </>
          )}
        </div>

        <PixelCanvas
          label={`Drawing of ${thing.name}, frame ${frame + 1}`}
          pixels={drawing(game, thing, frame, onion)}
          width={8}
          height={8}
          columns={8}
          rows={8}
          className="aspect-square w-full max-w-80"
          onPaint={(x, y) => edit((g) => setPixel(g, thing.key, frame, x, y, colour), `draw-${thing.key}`)}
          onStrokeEnd={() => projects.endGroup()}
        />
        <p className="flex items-center gap-1 text-muted">
          <Layers className="size-3" /> Colour 0 is see-through on the board.
        </p>
        {error && (
          <p role="alert" className="text-chili">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

export default defineTool({
  id: 'beat-things',
  title: 'Things',
  icon: Shapes,
  help: 'Draw the things in your game: heroes, walls, coins, enemies. Each is 8 by 8 pixels in your 4 colours, with an optional second frame.',
  component: Things,
  defaultPosition: 'right',
  defaultReference: 'beat-screens',
  openByDefault: true,
});
