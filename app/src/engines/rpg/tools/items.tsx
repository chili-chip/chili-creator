import { Backpack, Plus, Trash2 } from 'lucide-react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { Button } from '../../../ui/button';
import { Input, Select } from '../../../ui/input';
import { addItem, deleteItem, freshId, renameId } from '../edit';
import { eventFrom, eventParts } from '../events';
import { LIMITS, type Game, type Item } from '../model';
import { useGame, useSelection } from '../state';
import { EventForm } from './event-form';
import { NumberField } from './game';
import { ErrorLine, IdField, PicturePicker, Sprite, useEdit } from './shared';

const KINDS = [
  ['use', 'Use: runs its event, then one is used up'],
  ['equip', 'Equip: worn in a slot for a bonus'],
  ['key', 'Key: doors and events check for it'],
  ['quest', 'Quest: quests check for it'],
] as const;

/** Sets or removes an optional field. */
function opt<K extends keyof Item>(item: Item, key: K, value: Item[K] | undefined) {
  if (value === undefined) delete item[key];
  else item[key] = value;
}

function Slots({ game, edit }: { game: Game; edit(recipe: (g: Game) => void): boolean }) {
  const slots = game.slots ?? [];
  return (
    <section className="space-y-1">
      <h3 className="font-semibold">Equipment slots</h3>
      <ul aria-label="Slots" className="flex flex-wrap gap-1">
        {slots.map((slot, i) => (
          <li key={slot} className="flex items-center gap-0.5">
            <Input
              aria-label={`Slot ${i + 1}`}
              key={slot}
              defaultValue={slot}
              className="w-24 font-mono"
              onBlur={(event) => {
                const id = event.target.value.trim();
                if (id === slot) return;
                edit((g) => {
                  if (!/^[a-z0-9_-]{1,24}$/.test(id) || g.slots!.includes(id)) throw new Error('A slot id is 1 to 24 lower case letters, digits, - or _, and not used twice.');
                  g.slots![i] = id;
                  for (const it of g.items ?? []) if (it.slot === slot) it.slot = id;
                });
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete slot ${slot}`}
              onClick={() =>
                edit((g) => {
                  if (g.items?.some((it) => it.slot === slot)) throw new Error(`Items are worn in "${slot}". Change them first.`);
                  g.slots!.splice(i, 1);
                  if (!g.slots!.length) delete g.slots;
                })
              }
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {slots.length < LIMITS.slots && (
        <Button size="sm" variant="ghost" onClick={() => edit((g) => void (g.slots ??= []).push(freshId('slot', g.slots ?? [])))}>
          <Plus /> Add slot
        </Button>
      )}
      <p className="text-muted">For example weapon, armour, charm. One item is worn in each.</p>
    </section>
  );
}

function Items() {
  const game = useGame();
  const selection = useSelection(game);
  const { edit, error } = useEdit();
  if (!game) return <Empty icon={<Backpack />}>Open a Chili RPG game to add items.</Empty>;
  const item = selection.item;
  const change = (recipe: (it: Item, g: Game) => void, group?: string) => edit((g) => recipe(g.items!.find((it) => it.id === item!.id)!, g), group);
  const kind = item?.kind ?? 'use';

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs sm:flex-row">
      <section className="flex flex-col gap-3 sm:w-44">
        <ul aria-label="Items" className="grid grid-cols-6 gap-1 sm:grid-cols-4">
          {(game.items ?? []).map((it) => (
            <li key={it.id}>
              <button
                type="button"
                aria-label={it.name ?? it.id}
                aria-pressed={it.id === item?.id}
                title={it.name ?? it.id}
                onClick={() => selection.set({ item: it.id })}
                className="grid w-full place-items-center rounded border-2 border-line p-0.5 aria-pressed:border-chili"
              >
                <Sprite game={game} n={it.icon ?? 0} className="size-7" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button size="sm" disabled={(game.items?.length ?? 0) >= LIMITS.items} onClick={() => edit((g) => selection.set({ item: addItem(g).id }))}>
            <Plus /> Add item
          </Button>
          {item && (
            <Button size="sm" variant="ghost" aria-label={`Delete ${item.name ?? item.id}`} onClick={() => edit((g) => deleteItem(g, item.id))}>
              <Trash2 />
            </Button>
          )}
        </div>
        <Slots game={game} edit={edit} />
      </section>

      {item ? (
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <IdField value={item.id} onRename={(id) => edit((g) => renameId(g, 'item', item.id, id)) && selection.set({ item: id })} />
            <label className="flex flex-col gap-1">
              Name
              <Input aria-label="Name" maxLength={16} value={item.name ?? ''} onChange={(event) => change((it) => opt(it, 'name', event.target.value || undefined), `name-${item.id}`)} />
            </label>
            <label className="flex flex-col gap-1">
              Kind
              <Select
                aria-label="Kind of item"
                value={kind}
                onChange={(event) =>
                  change((it, g) => {
                    const next = event.target.value as Item['kind'];
                    opt(it, 'kind', next === 'use' ? undefined : next);
                    if (next === 'equip') {
                      it.slot ??= (g.slots ??= [freshId('slot', [])])[0]!;
                      delete it.stack;
                      delete it.use;
                    } else {
                      delete it.slot;
                      delete it.bonus;
                    }
                    if (next !== 'use') delete it.use;
                  })
                }
              >
                {KINDS.map(([id, text]) => (
                  <option key={id} value={id}>
                    {text}
                  </option>
                ))}
              </Select>
            </label>
            {kind !== 'equip' && (
              <NumberField label="Stack" value={item.stack ?? 1} min={1} max={99} onChange={(n) => change((it) => opt(it, 'stack', n > 1 ? n : undefined), `stack-${item.id}`)} />
            )}
          </div>
          <label className="flex flex-col gap-1">
            Text
            <Input aria-label="Text" maxLength={80} value={item.text ?? ''} onChange={(event) => change((it) => opt(it, 'text', event.target.value || undefined), `text-${item.id}`)} />
          </label>
          <div className="space-y-1">
            <h3 className="font-semibold">Picture</h3>
            <PicturePicker game={game} label="Picture" value={item.icon ?? 0} onPick={(n) => change((it) => void (it.icon = n))} />
          </div>
          {kind === 'equip' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                Slot
                <Select aria-label="Slot" value={item.slot ?? ''} onChange={(event) => change((it) => void (it.slot = event.target.value))}>
                  {(game.slots ?? []).map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </Select>
              </label>
              {game.stats
                .filter((s) => s.id !== 'hp')
                .map((stat) => (
                  <NumberField
                    key={stat.id}
                    label={`${stat.label ?? stat.id} bonus`}
                    value={item.bonus?.[stat.id] ?? 0}
                    min={-9999}
                    max={9999}
                    onChange={(n) =>
                      change((it) => {
                        const next = { ...it.bonus };
                        if (n) next[stat.id] = n;
                        else delete next[stat.id];
                        opt(it, 'bonus', Object.keys(next).length ? next : undefined);
                      }, `bonus-${item.id}-${stat.id}`)
                    }
                  />
                ))}
            </div>
          )}
          {kind === 'use' && (
            <EventForm game={game} label="When it is used" parts={eventParts(item.use)} onChange={(parts) => change((it) => opt(it, 'use', eventFrom(parts)))} />
          )}
          <ErrorLine error={error} />
        </section>
      ) : (
        <p className="text-muted">Add an item to start.</p>
      )}
    </div>
  );
}

export default defineTool({
  id: 'rpg-items',
  title: 'Items',
  icon: Backpack,
  help: 'Things for the bag: potions to use, gear to wear for a bonus, keys and quest items.',
  component: Items,
  defaultPosition: 'within',
  defaultReference: 'rpg-art',
});
