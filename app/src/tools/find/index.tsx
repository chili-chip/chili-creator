import { Search } from 'lucide-react';
import { useState } from 'react';
import {
  byId,
  colorsFor,
  drawingPixels,
  referencesTo,
  roomPixels,
  search,
  type Reference,
  type SearchCategory,
  type SearchResult,
  type World,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useSelection } from '../../shell/creator-context';
import { Input, Select } from '../../ui/input';
import { PixelImage } from '../../ui/pixel-canvas';
import { drawingName, Empty, useGoTo } from '../shared';

const categories: { value: SearchCategory; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'drawings', label: 'Drawings' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'dialog', label: 'Dialog and variables' },
  { value: 'colors', label: 'Colours' },
  { value: 'sound', label: 'Tunes and blips' },
];

/** A small picture of what a result points at, when it has one. The label says what it is. */
function Thumbnail({ world, result }: { world: World; result: Reference }) {
  const { at } = result;
  let picture = null;
  if (at.type === 'room' && byId(world.rooms, at.room)) {
    picture = <PixelImage pixels={roomPixels(world, at.room)} width={128} height={128} className="size-full" />;
  } else if (at.type === 'drawing') {
    const drawing = byId(world[at.kind], at.id);
    if (drawing) picture = <PixelImage pixels={drawingPixels(drawing, 0, colorsFor(world), at.kind)} width={8} height={8} className="size-full" />;
  } else if (at.type === 'palette') {
    const palette = byId(world.palettes, at.id);
    if (palette)
      picture = (
        <span className="flex size-full flex-col">
          {palette.colors.map((rgb, i) => (
            <span key={i} className="flex-1" style={{ background: `rgb(${rgb.join(',')})` }} />
          ))}
        </span>
      );
  }
  if (!picture) return null;
  return (
    <span aria-hidden data-testid="thumbnail" className="size-8 shrink-0 overflow-hidden rounded-sm">
      {picture}
    </span>
  );
}

function Results({ results, label, world }: { results: (Reference | SearchResult)[]; label: string; world: World }) {
  const goTo = useGoTo();
  return (
    <ul aria-label={label} className="space-y-1">
      {results.map((result, index) => (
        <li key={index}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-line bg-bg-0 px-2 py-1.5 text-left text-xs hover:border-muted/60"
            onClick={() => goTo(result.at)}
          >
            <Thumbnail world={world} result={result} />
            <span className="min-w-0">
              <span className="block text-text">{result.label}</span>
              {'detail' in result && result.detail && <span className="block truncate text-muted">{result.detail}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Find() {
  const { world, kind, drawing } = useSelection();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  if (!world) return <Empty icon={<Search />}>Open a game to find things in it.</Empty>;

  const found = search(world, query, category);
  const browsing = query.trim() !== '' || category !== 'all';
  const picked = drawing && kind ? drawingName(kind, drawing) : '';
  const uses = drawing && kind ? referencesTo(world, { type: 'drawing', kind, id: drawing.id }) : [];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Find in game"
          placeholder="Find a name or a line of dialog…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-40 flex-1"
        />
        <Select aria-label="Show" value={category} onChange={(event) => setCategory(event.target.value as SearchCategory)}>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      {browsing ? (
        found.length ? (
          <Results results={found} label="Found" world={world} />
        ) : (
          <p className="text-sm text-muted">{query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing here yet.'}</p>
        )
      ) : (
        picked && (
          <section className="space-y-2">
            <h3 className="text-xs text-muted">Where {picked} is used</h3>
            {uses.length ? <Results results={uses} label={`Uses of ${picked}`} world={world} /> : <p className="text-sm text-muted">Nowhere yet.</p>}
          </section>
        )
      )}
    </div>
  );
}

export default defineTool({
  id: 'find',
  title: 'Find',
  help: 'Find anything by name or by a line of dialog, browse by kind, and see where a drawing is used.',
  icon: Search,
  component: Find,
  defaultPosition: 'within',
  defaultReference: 'library',
});
