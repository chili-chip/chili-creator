import { Plus, Trash2, Users } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Checkbox, Input, Select } from '../../../ui/input';
import { addKind, deleteKind, renameId, whole } from '../edit';
import { eventFrom, eventParts } from '../events';
import { LIMITS, type Game, type Kind } from '../model';
import { lookSprite } from '../render';
import { useGame, useSelection } from '../state';
import { EventForm } from './event-form';
import { NumberField } from './game';
import { LookFields } from './hero';
import { ErrorLine, IdField, Sprite, useEdit } from './shared';

export const BRAINS = [
  ['still', 'Still: stays put, hits when you are next to it'],
  ['wander', 'Wander: takes random steps'],
  ['chase', 'Chase: walks to you when it sees you'],
  ['guard', 'Guard: chases near its home, then walks back'],
  ['patrol', 'Patrol: walks its patrol points (set in Rooms)'],
  ['coward', 'Coward: chases, runs away when hurt'],
] as const;

/** Sets or removes an optional field: `fallback` leaves it out of the file. */
function opt<T extends object, K extends keyof T>(o: T, key: K, value: T[K] | undefined, fallback?: T[K]) {
  if (value === undefined || value === fallback) delete o[key];
  else o[key] = value;
}

function Characters() {
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<Users />}>Open a Chili RPG game to add people and enemies.</Empty>;
  const kind = selection.kind;
  const change = (recipe: (k: Kind, g: Game) => void, group?: string) => edit((g) => recipe(g.kinds!.find((k) => k.id === kind!.id)!, g), group);
  const stats = game.stats.filter((s) => s.id !== 'max_hp');

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-2 sm:w-44">
        <ul aria-label="Characters" className="grid grid-cols-6 gap-1 sm:grid-cols-4">
          {(game.kinds ?? []).map((k) => (
            <li key={k.id}>
              <button
                type="button"
                aria-label={k.name ?? k.id}
                aria-pressed={k.id === kind?.id}
                title={k.name ?? k.id}
                onClick={() => selection.set({ kind: k.id })}
                className="grid w-full place-items-center rounded border-2 border-line p-0.5 aria-pressed:border-chili"
              >
                <Sprite game={game} n={lookSprite(k)} className="size-7" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={(game.kinds?.length ?? 0) >= LIMITS.kinds} onClick={() => edit((g) => selection.set({ kind: addKind(g).id }))}>
            <Plus /> Add character
          </Button>
          {kind && (
            <Button size="sm" variant="ghost" aria-label={`Delete ${kind.name ?? kind.id}`} onClick={() => edit((g) => deleteKind(g, kind.id))}>
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-muted">People, enemies, doors and chests. Place them in Rooms.</p>
      </section>

      {kind ? (
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <IdField value={kind.id} onRename={(id) => edit((g) => renameId(g, 'kind', kind.id, id)) && selection.set({ kind: id })} />
            <label className="flex flex-col gap-1">
              Name
              <Input aria-label="Name" maxLength={16} value={kind.name ?? ''} onChange={(event) => change((k) => opt(k, 'name', event.target.value || undefined), `name-${kind.id}`)} />
            </label>
            <Checkbox label="Friendly" checked={Boolean(kind.friendly)} onChange={(event) => change((k) => opt(k, 'friendly', event.target.checked || undefined))} />
          </div>
          <LookFields
            game={game}
            look={kind}
            onChange={(look) =>
              change((k) => {
                for (const key of ['sprite', 'sprites', 'frames'] as const) opt(k, key, look[key] as never);
              })
            }
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              Brain
              <Select aria-label="Brain" value={kind.brain ?? 'still'} onChange={(event) => change((k) => opt(k, 'brain', event.target.value, 'still'))}>
                {BRAINS.map(([id, text]) => (
                  <option key={id} value={id}>
                    {text}
                  </option>
                ))}
              </Select>
            </label>
            <NumberField label="Sight" value={kind.sight ?? 5} min={0} max={32} onChange={(n) => change((k) => opt(k, 'sight', n, 5), `sight-${kind.id}`)} />
            <NumberField label="Turns per step" value={kind.speed ?? 1} min={1} max={3} onChange={(n) => change((k) => opt(k, 'speed', n, 1))} />
            {kind.brain === 'guard' && <NumberField label="Home range" value={kind.home ?? 4} min={0} max={32} onChange={(n) => change((k) => opt(k, 'home', n, 4))} />}
            {kind.brain === 'coward' && <NumberField label="Runs below HP %" value={kind.flee ?? 30} min={0} max={100} onChange={(n) => change((k) => opt(k, 'flee', n, 30))} />}
          </div>

          {!kind.friendly && (
            <div className="space-y-2">
              <h3 className="font-semibold">Fighting</h3>
              <div className="flex flex-wrap gap-2">
                {stats.map((stat) => (
                  <NumberField
                    key={stat.id}
                    label={stat.label ?? stat.id}
                    value={kind.stats?.[stat.id] ?? 0}
                    min={0}
                    max={9999}
                    onChange={(n) =>
                      change((k) => {
                        const next = { ...k.stats };
                        if (n) next[stat.id] = n;
                        else delete next[stat.id];
                        opt(k, 'stats', Object.keys(next).length ? next : undefined);
                      }, `stat-${kind.id}-${stat.id}`)
                    }
                  />
                ))}
                <NumberField label="XP" value={kind.xp ?? 0} min={0} max={9999} onChange={(n) => change((k) => opt(k, 'xp', n, 0), `xp-${kind.id}`)} />
              </div>
              <ol aria-label="Drops" className="space-y-1">
                {(kind.drops ?? []).map((drop, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1">
                    Drops
                    <Select aria-label={`Drop ${i + 1} item`} value={drop.item} onChange={(event) => change((k) => void (k.drops![i]!.item = event.target.value))}>
                      {(game.items ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name ?? item.id}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label={`Drop ${i + 1} chance`}
                      type="number"
                      min={0}
                      max={100}
                      className="w-16"
                      value={drop.chance ?? 100}
                      onChange={(event) => change((k) => opt(k.drops![i]!, 'chance', whole(event.target.value, 0, 100), 100), `drop-${kind.id}-${i}`)}
                    />
                    % of the time
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete drop ${i + 1}`}
                      onClick={() =>
                        change((k) => {
                          k.drops!.splice(i, 1);
                          opt(k, 'drops', k.drops!.length ? k.drops : undefined);
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ol>
              {(game.items?.length ?? 0) > 0 && (kind.drops?.length ?? 0) < 8 && (
                <Button size="sm" variant="ghost" onClick={() => change((k) => void (k.drops ??= []).push({ item: game.items![0]!.id }))}>
                  <Plus /> Add drop
                </Button>
              )}
              <EventForm game={game} label="When it dies" parts={eventParts(kind.death)} onChange={(parts) => change((k) => opt(k, 'death', eventFrom(parts)))} />
            </div>
          )}

          {kind.friendly && (
            <div className="space-y-2">
              <h3 className="font-semibold">Talking</h3>
              <label className="flex flex-col gap-1">
                Dialogue
                <Select aria-label="Dialogue" value={kind.talk ?? ''} onChange={(event) => change((k) => opt(k, 'talk', event.target.value || undefined))}>
                  <option value="">None</option>
                  {(game.dialogue ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id}
                    </option>
                  ))}
                </Select>
              </label>
              <EventForm game={game} label="When you walk into it" parts={eventParts(kind.bump)} onChange={(parts) => change((k) => opt(k, 'bump', eventFrom(parts)))} />
            </div>
          )}
          <ErrorLine error={error} />
        </section>
      ) : (
        <p className="text-muted">Add a character to start.</p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'rpg-characters',
  title: 'Characters',
  icon: Users,
  help: 'People to talk to and enemies to fight: how they look, move and fight, what they say, and what happens when you meet them.',
  component: Characters,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
});
