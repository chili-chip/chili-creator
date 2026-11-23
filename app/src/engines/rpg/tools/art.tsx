import { Copy, Eraser, Palette, Plus } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { useCreator } from '../../../shell/creator-context';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { PixelCanvas } from '../../../ui/pixel-canvas';
import { addPicture, setPixel } from '../edit';
import { LIMITS, SWEETIE_16 } from '../model';
import { pictureRGBA } from '../render';
import { useGame, useSelection } from '../state';
import { ErrorLine, Sprite, useEdit } from './shared';
import { useState } from 'react';

const COLOURS = '0123456789abcdef';

/** The drawing with a checkerboard where it is clear, so clear pixels show. */
function drawing(picture: string[] | undefined): Uint8ClampedArray {
  const pixels = pictureRGBA(picture);
  for (let i = 0; i < 64; i++) {
    if (pixels[i * 4 + 3]) continue;
    const shade = (Math.floor(i / 8) + (i % 8)) % 2 ? 0x33 : 0x22;
    pixels.set([shade, shade, shade, 255], i * 4);
  }
  return pixels;
}

function Art() {
  const { projects } = useCreator();
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  const [colour, setColour] = useState('c');
  if (!game) return <Empty icon={<Palette />}>Open a Chili RPG game to draw its pictures.</Empty>;
  const pictures = game.art?.pictures ?? [];
  const n = selection.picture;
  const add = (from?: number) =>
    edit((g) => {
      selection.set({ picture: addPicture(g, from) });
    });

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-2 sm:w-60">
        <ul aria-label="Pictures" className="grid max-h-80 grid-cols-8 gap-0.5 overflow-auto">
          {pictures.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Picture ${i}`}
                aria-pressed={i === n}
                title={`Picture ${i}`}
                onClick={() => selection.set({ picture: i })}
                className="grid w-full place-items-center rounded-sm border-2 border-transparent aria-pressed:border-chili"
              >
                <Sprite game={game} n={i} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={pictures.length >= LIMITS.pictures} onClick={() => add()}>
            <Plus /> Add picture
          </Button>
          <Button size="sm" variant="ghost" disabled={!pictures.length || pictures.length >= LIMITS.pictures} onClick={() => add(n)}>
            <Copy /> Copy
          </Button>
        </div>
        <p className="text-muted">
          {pictures.length} of {LIMITS.pictures}. Tiles, people and items use pictures by number. Walk frames are the pictures right after.
        </p>
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-2">
        <div role="radiogroup" aria-label="Colour" className="grid w-fit grid-cols-9 gap-1">
          {[...COLOURS].map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={colour === c}
              aria-label={`Sweetie ${i} ${SWEETIE_16[i]}`}
              title={`${c} ${SWEETIE_16[i]}`}
              onClick={() => setColour(c)}
              style={{ background: SWEETIE_16[i] }}
              className="size-7 rounded border-2 border-line aria-checked:border-phosphor"
            />
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={colour === '.'}
            aria-label="Clear"
            title="Clear: what is under it shows"
            onClick={() => setColour('.')}
            className="grid size-7 place-items-center rounded border-2 border-line aria-checked:border-phosphor"
          >
            <Eraser className="size-4" />
          </button>
        </div>
        {pictures[n] ? (
          <PixelCanvas
            label={`Drawing of picture ${n}`}
            pixels={drawing(pictures[n])}
            width={8}
            height={8}
            columns={8}
            rows={8}
            className="aspect-square w-full max-w-80"
            onPaint={(x, y) => edit((g) => setPixel(g, n, x, y, colour), `draw-${n}`)}
            onStrokeEnd={() => projects.endGroup()}
          />
        ) : (
          <p className="text-muted">Add a picture to start drawing.</p>
        )}
        <p className="text-muted">
          Sweetie 16 by{' '}
          <a className="underline" href="https://lospec.com/palette-list/sweetie-16" target="_blank" rel="noreferrer">
            GrafxKid
          </a>
          .
        </p>
        <ErrorLine error={error} />
      </section>
    </div>
  );
}

export default defineTool({
  id: 'rpg-art',
  title: 'Art',
  icon: Palette,
  help: 'Draw the pictures for tiles, people and items: 8 by 8 pixels in Sweetie 16, with clear pixels.',
  component: Art,
  defaultPosition: 'right',
  defaultReference: 'rpg-rooms',
  openByDefault: true,
});
