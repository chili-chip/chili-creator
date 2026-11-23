import { Plus, Trash2, UserRound } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { eventFrom, eventParts } from '../events';
import type { Game, Look } from '../model';
import { useGame } from '../state';
import { EventForm } from './event-form';
import { NumberField } from './game';
import { ErrorLine, PicturePicker, Sprite, useEdit } from './shared';

/** A look: the picture facing down, and walk frames (the pictures right after it). */
export function LookFields({ game, look, onChange }: { game: Game; look: Look; onChange(look: Look): void }) {
  const frames = look.frames ?? 1;
  const first = look.sprites?.down ?? look.sprite ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-0.5" aria-label="Walk frames">
          {Array.from({ length: frames }, (_, i) => (
            <Sprite key={i} game={game} n={first + i} className="size-8" />
          ))}
        </div>
        <NumberField
          label="Walk frames"
          value={frames}
          min={1}
          max={4}
          onChange={(n) => {
            const next = { ...look };
            if (n > 1) next.frames = n;
            else delete next.frames;
            onChange(next);
          }}
        />
      </div>
      <p className="text-muted">Pick the picture. Walk frames are the pictures right after it.</p>
      <PicturePicker
        game={game}
        label="Picture"
        value={first}
        onPick={(n) => {
          const next = { ...look, sprite: n };
          delete next.sprites;
          onChange(next);
        }}
      />
    </div>
  );
}

function Hero() {
  const game = useGame();
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<UserRound />}>Open a Chili RPG game to set up its hero.</Empty>;
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
      <section className="space-y-1">
        <h3 className="font-semibold">Look</h3>
        <LookFields game={game} look={game.player} onChange={(look) => edit((g) => void (g.player = look), 'look')} />
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
      <EventForm
        game={game}
        label="When the hero dies"
        parts={eventParts(game.lose)}
        onChange={(parts) =>
          edit((g) => {
            const event = eventFrom(parts);
            if (event) g.lose = event;
            else delete g.lose;
          })
        }
      />
      <p className="text-muted">After it runs, the game is lost if the hero still has no HP. Heal and warp to bring the hero back.</p>
      <ErrorLine error={error} />
    </div>
  );
}

export default defineTool({
  id: 'rpg-hero',
  title: 'Hero',
  icon: UserRound,
  help: 'The hero: how it looks, its stats, the XP for each level, and what happens when it dies.',
  component: Hero,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
});
