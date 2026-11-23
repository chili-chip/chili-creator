import { Plus, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Checkbox, Input, Select } from '../../../ui/input';
import { setRule, whole } from '../edit';
import { SWEETIE_16, type Game } from '../model';
import { useGame, useUpdate } from '../state';

const RULES = [
  { key: 'step_ms', label: 'Step time (ms)', fallback: 80, min: 0, max: 1000, help: 'How long one step slides.' },
  { key: 'bag', label: 'Bag size', fallback: 16, min: 1, max: 32, help: 'Slots in the bag.' },
  { key: 'spread', label: 'Damage spread', fallback: 0, min: 0, max: 99, help: 'Hits vary by up to this much.' },
  { key: 'crit', label: 'Critical hits (%)', fallback: 0, min: 0, max: 100, help: 'Chance of double damage.' },
] as const;

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(n: number): void }) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <Input aria-label={label} type="number" min={min} max={max} className="w-20" value={value} onChange={(event) => onChange(whole(event.target.value, min, max))} />
    </label>
  );
}

function GameSettings() {
  const game = useGame();
  const update = useUpdate();
  const [error, setError] = useState('');
  if (!game) return <Empty icon={<Settings2 />}>Open a Chili RPG game to change its settings.</Empty>;

  function edit(recipe: (game: Game) => void, group?: string) {
    setError('');
    try {
      update(recipe, group ? { group } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const startRoom = game.rooms.find((r) => r.id === game.start.room) ?? game.rooms[0]!;
  const xp = game.levels?.xp ?? [];
  const gain = game.levels?.gain ?? {};
  const setLevels = (g: Game, levels: NonNullable<Game['levels']>) => {
    if (levels.gain && !Object.keys(levels.gain).length) delete levels.gain;
    if (levels.xp && !levels.xp.length) delete levels.xp;
    if (Object.keys(levels).length) g.levels = levels;
    else delete g.levels;
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-3 text-xs">
      <label className="flex flex-col gap-1">
        Author
        <Input aria-label="Author" value={game.author ?? ''} maxLength={32} onChange={(event) => edit((g) => void (g.author = event.target.value), 'author')} />
      </label>

      <section className="space-y-1">
        <h3 className="font-semibold">Background</h3>
        <p className="text-muted">Shows behind the map, where tiles are clear.</p>
        <div role="group" aria-label="Background" className="grid w-fit grid-cols-8 gap-1">
          {SWEETIE_16.map((hex, i) => (
            <button
              key={hex}
              type="button"
              aria-label={`Background Sweetie ${i} ${hex}`}
              aria-pressed={(game.background ?? '#000000').toLowerCase() === hex}
              title={`${i} ${hex}`}
              onClick={() => edit((g) => void (g.background = hex))}
              style={{ background: hex }}
              className="size-6 rounded border-2 border-line aria-pressed:border-phosphor"
            />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <h3 className="w-full font-semibold">Start</h3>
        <label className="flex flex-col gap-1">
          Room
          <Select aria-label="Start room" value={game.start.room} onChange={(event) => edit((g) => void (g.start = { room: event.target.value, x: 1, y: 1 }))}>
            {game.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name ?? r.id}
              </option>
            ))}
          </Select>
        </label>
        <NumberField label="Start x" value={game.start.x} min={0} max={(startRoom.ground[0]?.length ?? 16) - 1} onChange={(x) => edit((g) => void (g.start = { ...g.start, x }), 'start')} />
        <NumberField label="Start y" value={game.start.y} min={0} max={startRoom.ground.length - 1} onChange={(y) => edit((g) => void (g.start = { ...g.start, y }), 'start')} />
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <h3 className="w-full font-semibold">Rules</h3>
        {RULES.map((rule) => (
          <div key={rule.key} title={rule.help}>
            <NumberField
              label={rule.label}
              value={game.rules?.[rule.key] ?? rule.fallback}
              min={rule.min}
              max={rule.max}
              onChange={(n) => edit((g) => setRule(g, rule.key, n, rule.fallback), rule.key)}
            />
          </div>
        ))}
        <Checkbox label="Diagonal steps" checked={game.rules?.diagonal ?? false} onChange={(event) => edit((g) => setRule(g, 'diagonal', event.target.checked, false))} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Hero stats</h3>
        <p className="text-muted">HP is health now, MAX the most it can be. ATK adds to hits, DEF takes from hits you get.</p>
        <div className="flex flex-wrap gap-3">
          {game.stats.map((stat, i) => (
            <NumberField
              key={stat.id}
              label={`${stat.label ?? stat.id} at the start`}
              value={stat.start ?? 0}
              min={-9999}
              max={9999}
              onChange={(n) => edit((g) => void (g.stats[i]!.start = n), `stat-${stat.id}`)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Levels</h3>
        <p className="text-muted">The XP the hero needs for each level, and what it gains each time.</p>
        <ol aria-label="Levels" className="flex flex-wrap gap-2">
          {xp.map((need, i) => (
            <li key={i} className="flex items-end gap-1">
              <NumberField
                label={`XP for level ${i + 2}`}
                value={need}
                min={1}
                max={99999}
                onChange={(n) => edit((g) => setLevels(g, { ...g.levels, xp: xp.map((v, j) => (j === i ? n : v)) }), `xp-${i}`)}
              />
              <Button size="icon" variant="ghost" aria-label={`Delete level ${i + 2}`} onClick={() => edit((g) => setLevels(g, { ...g.levels, xp: xp.filter((_, j) => j !== i) }))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        {xp.length < 99 && (
          <Button size="sm" onClick={() => edit((g) => setLevels(g, { ...g.levels, xp: [...xp, (xp.at(-1) ?? 0) * 2 || 10] }))}>
            <Plus /> Add level
          </Button>
        )}
        <div className="flex flex-wrap gap-3">
          {game.stats
            .filter((stat) => stat.id !== 'hp')
            .map((stat) => (
              <NumberField
                key={stat.id}
                label={`${stat.label ?? stat.id} gained each level`}
                value={gain[stat.id] ?? 0}
                min={-9999}
                max={9999}
                onChange={(n) =>
                  edit((g) => {
                    const next = { ...g.levels?.gain };
                    if (n) next[stat.id] = n;
                    else delete next[stat.id];
                    setLevels(g, { ...g.levels, gain: next });
                  }, `gain-${stat.id}`)
                }
              />
            ))}
        </div>
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
  id: 'rpg-game',
  title: 'Game',
  icon: Settings2,
  help: 'The whole game: author, background, where it starts, rules, the hero stats and levels.',
  component: GameSettings,
});
