import { Search } from 'lucide-react';
import { useState } from 'react';
import { referencesTo, search, type Reference, type SearchResult } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useSelection } from '../../shell/creator-context';
import { Input } from '../../ui/input';
import { drawingName, Empty, useGoTo } from '../shared';

function Results({ results, label }: { results: (Reference | SearchResult)[]; label: string }) {
  const goTo = useGoTo();
  return (
    <ul aria-label={label} className="space-y-1">
      {results.map((result, index) => (
        <li key={index}>
          <button
            type="button"
            className="w-full rounded-md border border-line bg-bg-0 px-2 py-1.5 text-left text-xs hover:border-muted/60"
            onClick={() => goTo(result.at)}
          >
            <span className="block text-text">{result.label}</span>
            {'detail' in result && result.detail && <span className="block truncate text-muted">{result.detail}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Find() {
  const { world, kind, drawing } = useSelection();
  const [query, setQuery] = useState('');
  if (!world) return <Empty icon={<Search />}>Open a game to find things in it.</Empty>;

  const found = search(world, query);
  const picked = drawing && kind ? drawingName(kind, drawing) : '';
  const uses = drawing && kind ? referencesTo(world, { type: 'drawing', kind, id: drawing.id }) : [];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <Input
        type="search"
        aria-label="Find in game"
        placeholder="Find a name or a line of dialog…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() ? (
        found.length ? (
          <Results results={found} label="Found" />
        ) : (
          <p className="text-sm text-muted">Nothing matches “{query.trim()}”.</p>
        )
      ) : (
        picked && (
          <section className="space-y-2">
            <h3 className="text-xs text-muted">Where {picked} is used</h3>
            {uses.length ? <Results results={uses} label={`Uses of ${picked}`} /> : <p className="text-sm text-muted">Nowhere yet.</p>}
          </section>
        )
      )}
    </div>
  );
}

export default defineTool({
  id: 'find',
  title: 'Find',
  icon: Search,
  component: Find,
  defaultPosition: 'within',
  defaultReference: 'library',
});
