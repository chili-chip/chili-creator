import { Plus, Trash2, Variable as VariableIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addVariable, byId, drawingName, referencesTo, removeVariable, renameVariable, setStartingItem, startingItem, type Variable } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useWorld } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { count, Empty } from '../shared';

/** A variable's name and start value. The name changes when it is let go, everywhere at once. */
function Row({ variable, uses }: { variable: Variable; uses: number }) {
  const creator = useCreator();
  const [name, setName] = useState(variable.id);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => setName(variable.id), [variable.id]);

  function rename() {
    if (name === variable.id) return;
    let done = false;
    creator.projects.updateWorld((w) => {
      done = renameVariable(w, variable.id, name);
    });
    if (!done) {
      setRefused(name);
      setName(variable.id);
    } else setRefused(null);
  }

  return (
    <li className="space-y-1 rounded-md border border-line bg-bg-0 p-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label={`Name of ${variable.id}`}
          value={name}
          className="w-28 font-mono"
          onChange={(event) => setName(event.target.value.trim())}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') rename();
          }}
        />
        <span className="text-xs text-muted">starts at</span>
        <Input
          aria-label={`Start value of ${variable.id}`}
          value={variable.value}
          className="w-20 font-mono"
          onChange={(event) => {
            const value = event.target.value;
            const id = variable.id;
            creator.projects.updateWorld(
              (w) => {
                const target = byId(w.variables, id);
                if (target) target.value = value;
              },
              { group: `variable-${id}` },
            );
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${variable.id}`}
          title="Delete"
          className="ml-auto"
          onClick={() => creator.projects.updateWorld((w) => void removeVariable(w, variable.id))}
        >
          <Trash2 />
        </Button>
      </div>
      <p className="text-[11px] text-muted">{uses ? `Used in ${count(uses, 'dialog')}` : 'Not used yet'}</p>
      {refused !== null && (
        <p role="alert" className="text-[11px] text-chili">
          “{refused}” is taken or is not a name. Use letters, digits and _.
        </p>
      )}
    </li>
  );
}

function Variables() {
  const creator = useCreator();
  const world = useWorld();
  if (!world) return <Empty icon={<VariableIcon />}>Open a game to keep track of things with variables.</Empty>;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      {world.variables.length === 0 ? (
        <p className="text-sm text-muted">No variables yet. Dialogs can count and remember things with them.</p>
      ) : (
        <ul aria-label="Variables" className="space-y-2">
          {world.variables.map((variable, index) => (
            <Row
              key={index}
              variable={variable}
              uses={referencesTo(world, { type: 'variable', id: variable.id }).length}
            />
          ))}
        </ul>
      )}
      <Button size="sm" variant="primary" className="w-fit" onClick={() => creator.projects.updateWorld((w) => void addVariable(w))}>
        <Plus />
        New variable
      </Button>

      <section aria-label="Starting items" className="space-y-1.5 border-t border-line pt-3">
        <h2 className="text-xs text-text">The avatar starts with</h2>
        {world.items.length === 0 ? (
          <p className="text-xs text-muted">No items yet.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {world.items.map((item) => {
              const name = drawingName('items', item);
              return (
                <li key={item.id}>
                  <label className="flex items-center justify-between gap-2 text-xs text-muted">
                    {name}
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Starting ${name}`}
                      value={startingItem(world, item.id)}
                      className="w-20 text-right tabular-nums"
                      onChange={(event) => {
                        const n = Math.max(0, Math.round(Number(event.target.value) || 0));
                        creator.projects.updateWorld((w) => setStartingItem(w, item.id, n), { group: `start-${item.id}` });
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default defineTool({
  id: 'variables',
  title: 'Variables',
  help: 'Numbers and words the dialog can read and change, and the items the avatar starts with.',
  icon: VariableIcon,
  component: Variables,
  defaultPosition: 'within',
  defaultReference: 'dialog',
  openByDefault: true,
  openInBackground: true,
});
