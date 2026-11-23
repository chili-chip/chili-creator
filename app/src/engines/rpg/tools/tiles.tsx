import { Grid3x3, Plus, Trash2 } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Checkbox, Input } from '../../../ui/input';
import { addTile, deleteTile, whole } from '../edit';
import type { Game, Tile } from '../model';
import { tileSprite } from '../render';
import { useGame, useSelection } from '../state';
import { ErrorLine, PicturePicker, Sprite, useEdit } from './shared';

const FLAGS = [
  ['solid', 'Solid', 'Blocks walking and sight: walls, trees.'],
  ['water', 'Water', 'Blocks walking, not sight.'],
  ['save', 'Save point', 'Saves the game when the hero steps on it.'],
] as const;

function Tiles() {
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<Grid3x3 />}>Open a Chili RPG game to set up its tiles.</Empty>;
  const tile = selection.tile!;
  const frames = [tile.sprite].flat();
  const change = (recipe: (t: Tile, g: Game) => void, group?: string) =>
    edit((g) => recipe(g.tiles.find((t) => t.key === tile.key)!, g), group);
  const setFrames = (t: Tile, list: number[]) => {
    t.sprite = list.length === 1 ? list[0]! : list;
    if (list.length === 1) delete t.frame_ms;
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-2 sm:w-44">
        <ul aria-label="Tiles" className="grid grid-cols-6 gap-1 sm:grid-cols-4">
          {game.tiles.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                aria-label={`Tile ${t.key}`}
                aria-pressed={t.key === tile.key}
                title={`Tile ${t.key}`}
                onClick={() => selection.set({ tile: t.key })}
                className="relative grid w-full place-items-center rounded border-2 border-line p-0.5 aria-pressed:border-chili"
              >
                <Sprite game={game} n={tileSprite(t.sprite)} className="size-7" />
                {t.solid && <span className="absolute right-0.5 bottom-0 text-[9px]">■</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" onClick={() => edit((g) => selection.set({ tile: addTile(g, selection.picture).key }))}>
            <Plus /> Add tile
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Delete tile ${tile.key}`} disabled={game.tiles.length <= 1} onClick={() => edit((g) => deleteTile(g, tile.key))}>
            <Trash2 />
          </Button>
        </div>
        <p className="text-muted">The first tile fills new rooms.</p>
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-muted" title="The character this tile uses in the file">
            Key {tile.key}
          </span>
          {FLAGS.map(([flag, label, help]) => (
            <span key={flag} title={help}>
              <Checkbox
                label={label}
                checked={Boolean(tile[flag])}
                onChange={(event) =>
                  change((t) => {
                    if (event.target.checked) t[flag] = true;
                    else delete t[flag];
                  })
                }
              />
            </span>
          ))}
          <label className="flex items-center gap-1" title="Hurts whoever steps on it: fire, spikes">
            Damage
            <Input
              aria-label="Damage"
              type="number"
              min={0}
              max={999}
              className="w-16"
              value={tile.damage ?? 0}
              onChange={(event) =>
                change((t) => {
                  const n = whole(event.target.value, 0, 999);
                  if (n) t.damage = n;
                  else delete t.damage;
                }, `damage-${tile.key}`)
              }
            />
          </label>
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold">Frames</h3>
          <div role="radiogroup" aria-label="Frames" className="flex flex-wrap items-center gap-1">
            {frames.map((n, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <Sprite game={game} n={n} className="size-8" />
                {frames.length > 1 && (
                  <Button size="icon" variant="ghost" aria-label={`Remove frame ${i + 1}`} onClick={() => change((t) => setFrames(t, frames.filter((_, j) => j !== i)))}>
                    <Trash2 />
                  </Button>
                )}
              </span>
            ))}
            {frames.length < 4 && (
              <Button size="sm" variant="ghost" onClick={() => change((t) => setFrames(t, [...frames, frames.at(-1)!]))}>
                <Plus /> Add frame
              </Button>
            )}
            {frames.length > 1 && (
              <label className="flex items-center gap-1">
                ms each
                <Input
                  aria-label="Frame time"
                  type="number"
                  min={50}
                  max={5000}
                  className="w-20"
                  value={tile.frame_ms ?? 400}
                  onChange={(event) => change((t) => void (t.frame_ms = whole(event.target.value, 50, 5000)), `frame-ms-${tile.key}`)}
                />
              </label>
            )}
          </div>
          <p className="text-muted">Pick the picture for the last frame.</p>
          <PicturePicker
            game={game}
            label="Picture"
            value={frames.at(-1)}
            onPick={(n) => change((t) => setFrames(t, [...frames.slice(0, -1), n]))}
          />
        </div>
        <ErrorLine error={error} />
      </section>
    </div>
  );
}

export default defineTool({
  id: 'rpg-tiles',
  title: 'Tiles',
  icon: Grid3x3,
  help: 'The kinds of ground: a picture (or up to 4 that take turns), and whether it is solid, water, a save point or hurts.',
  component: Tiles,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
  openByDefault: true,
  openInBackground: true,
});
