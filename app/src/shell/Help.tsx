import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ToolDefinition } from '../plugin-api';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

export const CREATOR_DOCS = 'https://creator.chilichip.eu/';

/** Tools every editor shares; their pages are in Get started. */
const SHARED = new Set(['projects']);

/** The tool's page in the creator docs: docs/editors/<editor>/tools/<id>.md, or docs/get-started/<id>.md for shared tools. */
export const toolDocs = (id: string, editor: string) =>
  SHARED.has(id) ? `${CREATOR_DOCS}get-started/${id}/` : `${CREATOR_DOCS}editors/${editor}/tools/${id}/`;

/** What each tool is for, with a way to open it, and where to learn more. */
export function Help({
  tools,
  editor,
  phone,
  onOpenTool,
  onTour,
  onClose,
}: {
  tools: readonly ToolDefinition[];
  /** The editor whose tools are showing, for the docs links. */
  editor: string;
  phone: boolean;
  onOpenTool(id: string): void;
  onTour(): void;
  onClose(): void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section
      role="dialog"
      aria-label="Help"
      aria-modal="false"
      className={cn(
        'fixed z-50 flex flex-col gap-3 overflow-auto rounded-md border border-line bg-bg-2 p-3 text-sm shadow-xl',
        phone ? 'inset-x-3 top-14 bottom-20' : 'right-4 bottom-10 max-h-[70vh] w-96',
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display text-base font-bold">Help</h2>
        <Button size="icon" variant="ghost" aria-label="Close help" className="ml-auto" onClick={onClose}>
          <X />
        </Button>
      </div>
      <p className="text-xs text-muted">
        The creator has an editor for each kind of game. The{' '}
        <a href={CREATOR_DOCS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-phosphor underline">
          Creator docs
          <ExternalLink className="size-3" aria-hidden />
        </a>{' '}
        have a tutorial and a page for every tool of each editor. {!phone && 'Press Ctrl+K to find any command.'}
      </p>
      <Button size="sm" variant="secondary" className="w-fit" onClick={onTour}>
        Take the tour
      </Button>
      <ul aria-label="Tools" className="space-y-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <li key={tool.id} className="flex items-start gap-2 text-xs">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-text">{tool.title}</h3>
                {tool.help && <p className="text-muted">{tool.help}</p>}
                <a
                  href={toolDocs(tool.id, editor)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Learn more about ${tool.title}`}
                  className="text-phosphor underline"
                >
                  Learn more
                </a>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Open ${tool.title}`} onClick={() => onOpenTool(tool.id)}>
                Open
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
