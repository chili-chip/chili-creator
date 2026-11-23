// Pieces the Chili RPG tools share.
import { useMemo, useState } from 'react';
import { PixelImage } from '../../../ui/pixel-canvas';
import type { Game } from '../model';
import { pictureRGBA } from '../render';
import { useUpdate } from '../state';

/** One picture of the game, small. */
export function Sprite({ game, n, className = 'size-6' }: { game: Game; n: number | undefined; className?: string }) {
  const picture = n === undefined ? undefined : game.art?.pictures[n];
  const pixels = useMemo(() => pictureRGBA(picture), [picture]);
  return <PixelImage pixels={pixels} width={8} height={8} className={`${className} bg-[repeating-conic-gradient(#333_0_25%,#222_0_50%)] bg-[length:8px_8px]`} />;
}

/** Picks one of the game's pictures. */
export function PicturePicker({ game, value, label, onPick }: { game: Game; value: number | undefined; label: string; onPick(n: number): void }) {
  const pictures = game.art?.pictures ?? [];
  if (!pictures.length) return <p className="text-muted">Draw pictures in Art first.</p>;
  return (
    <div role="group" aria-label={label} className="grid max-h-40 w-fit grid-cols-8 gap-0.5 overflow-auto sm:grid-cols-12">
      {pictures.map((_, n) => (
        <button
          key={n}
          type="button"
          aria-label={`Use picture ${n}`}
          aria-pressed={value === n}
          title={`Picture ${n}`}
          onClick={() => onPick(n)}
          className="rounded-sm border-2 border-transparent aria-pressed:border-phosphor"
        >
          <Sprite game={game} n={n} className="size-5" />
        </button>
      ))}
    </div>
  );
}

/** A tool's edit function that shows what went wrong instead of throwing. */
export function useEdit() {
  const update = useUpdate();
  const [error, setError] = useState('');
  function edit(recipe: (game: Game) => void, group?: string) {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return { edit, error };
}

export function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-chili">
      {error}
    </p>
  );
}
