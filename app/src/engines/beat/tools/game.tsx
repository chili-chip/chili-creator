import { Plus, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Input, Select } from '../../../ui/input';
import { Segmented } from '../../../ui/segmented';
import { addCounter } from '../edit';
import { SWEETIE_16, type Game } from '../model';
import { useGame, useUpdate } from '../state';

/** Pick each of the game's 4 colours from Sweetie 16. */
function PalettePicker({ game, onPick }: { game: Game; onPick(slot: number, colour: number): void }) {
  const [slot, setSlot] = useState(0);
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Game colours" className="flex gap-1">
        {game.palette.map((colour, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={slot === i}
            aria-label={i === 0 ? 'Colour 0 (background)' : `Colour ${i}`}
            onClick={() => setSlot(i)}
            style={{ background: SWEETIE_16[colour] }}
            className="h-8 w-10 rounded border-2 border-line aria-checked:border-phosphor"
          />
        ))}
      </div>
      <div role="grid" aria-label="Sweetie 16" className="grid w-fit grid-cols-8 gap-1">
        {SWEETIE_16.map((hex, i) => (
          <button
            key={hex}
            type="button"
            aria-label={`Sweetie ${i} ${hex}`}
            title={`${i} ${hex}`}
            onClick={() => onPick(slot, i)}
            style={{ background: hex }}
            className="size-6 rounded border border-line"
          />
        ))}
      </div>
      <p className="text-muted">
        Sweetie 16 by <a className="underline" href="https://lospec.com/palette-list/sweetie-16" target="_blank" rel="noreferrer">GrafxKid</a>.
      </p>
    </div>
  );
}

function GameSettings() {
  const game = useGame();
  const update = useUpdate();
  const [error, setError] = useState('');
  if (!game) return <Empty icon={<Settings2 />}>Open a Chili Beat game to change its settings.</Empty>;

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
      <label className="flex flex-col gap-1">
        Author
        <Input aria-label="Author" value={game.author ?? ''} maxLength={32} onChange={(event) => edit((g) => void (g.author = event.target.value), 'author')} />
      </label>

      <section className="space-y-1">
        <h3 className="font-semibold">Colours</h3>
        <PalettePicker game={game} onPick={(slot, colour) => edit((g) => void (g.palette[slot] = colour))} />
      </section>

      <section className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          Tempo: {game.tempo} beats a second
          <input
            aria-label="Tempo"
            type="range"
            min={2}
            max={8}
            value={game.tempo}
            onChange={(event) => edit((g) => void (g.tempo = Number(event.target.value)), 'tempo')}
            className="accent-chili"
          />
        </label>
        <Segmented
          label="Time"
          value={game.time}
          options={[
            { value: 'beat', label: 'On the beat' },
            { value: 'turns', label: 'In turns' },
          ]}
          onChange={(time) => edit((g) => void (g.time = time))}
        />
        <label className="flex flex-col gap-1">
          Start screen
          <Select aria-label="Start screen" value={game.start} onChange={(event) => edit((g) => void (g.start = event.target.value))}>
            {game.screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </Select>
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Counters</h3>
        <p className="text-muted">Up to 4 numbers, shown over the top-left corner of the screen.</p>
        <ul aria-label="Counters" className="space-y-1">
          {(game.counters ?? []).map((counter, i) => (
            <li key={counter.id} className="flex flex-wrap items-center gap-1">
              <Input
                aria-label={`Counter ${i + 1} name`}
                value={counter.name}
                maxLength={16}
                onChange={(event) => edit((g) => void (g.counters![i]!.name = event.target.value), `counter-${i}`)}
              />
              <Select aria-label={`Counter ${i + 1} icon`} value={counter.icon} onChange={(event) => edit((g) => void (g.counters![i]!.icon = event.target.value))}>
                {game.things.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Counter ${i + 1} start`}
                type="number"
                min={0}
                max={999}
                className="w-16"
                value={counter.start ?? 0}
                onChange={(event) => edit((g) => void (g.counters![i]!.start = Math.max(0, Math.min(999, Math.round(Number(event.target.value)) || 0))))}
              />
              <Button size="icon" variant="ghost" aria-label={`Delete counter ${counter.name}`} onClick={() => edit((g) => void g.counters!.splice(i, 1))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {(game.counters ?? []).length < 4 && (
          <Button size="sm" onClick={() => edit((g) => void addCounter(g))}>
            <Plus /> Add counter
          </Button>
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
  id: 'beat-game',
  title: 'Game',
  icon: Settings2,
  help: 'The whole game: its 4 colours, tempo, beat or turns, start screen and counters.',
  component: GameSettings,
});
