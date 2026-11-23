// Pieces the Chili RPG tools share.
import { useMemo, useState } from 'react';
import { Input } from '../../../ui/input';
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
  /** Runs a change; false when it was refused (the error shows). */
  function edit(recipe: (game: Game) => void, group?: string): boolean {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
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

/** An id that changes everywhere it is used when the field loses focus. */
export function IdField({ value, onRename }: { value: string; onRename(id: string): void }) {
  return (
    <label className="flex flex-col gap-1">
      Id
      <Input
        aria-label="Id"
        key={value}
        defaultValue={value}
        className="w-32 font-mono"
        title="Used in the file. Changing it changes everything that names it."
        onBlur={(event) => {
          const id = event.target.value.trim();
          if (id === value) return;
          onRename(id);
        }}
      />
    </label>
  );
}
