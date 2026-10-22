import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ToolDefinition } from '../plugin-api';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

export const BITSY_DOCS = 'https://make.bitsy.org/docs/';

/** What each tool is for, with a way to open it, and where to learn more. */
export function Help({
  tools,
  phone,
  onOpenTool,
  onTour,
  onClose,
}: {
  tools: readonly ToolDefinition[];
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
        This creator makes Bitsy games. The{' '}
        <a href={BITSY_DOCS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-phosphor underline">
          Bitsy docs
          <ExternalLink className="size-3" aria-hidden />
        </a>{' '}
        explain rooms, dialog scripting and more. {!phone && 'Press Ctrl+K to find any command.'}
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
