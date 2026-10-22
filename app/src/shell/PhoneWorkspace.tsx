import { useState } from 'react';
import type { ToolDefinition } from '../plugin-api';

/**
 * A phone shows one tool at a time. Tools stay mounted once opened, hidden
 * while another is in front, so a running game or a half-typed name survives
 * a look at another tool.
 */
export function PhoneWorkspace({ tools, current }: { tools: readonly ToolDefinition[]; current: string }) {
  const [visited, setVisited] = useState<string[]>([current]);
  if (!visited.includes(current)) setVisited([...visited, current]);

  return (
    <div className="h-full">
      {tools
        .filter((tool) => visited.includes(tool.id) || tool.id === current)
        .map((tool) => {
          const Tool = tool.component;
          return (
            <section key={tool.id} aria-label={tool.title} hidden={tool.id !== current} className="h-full min-h-0 overflow-hidden">
              <Tool />
            </section>
          );
        })}
    </div>
  );
}
