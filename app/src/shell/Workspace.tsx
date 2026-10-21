import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState, type FunctionComponent } from 'react';
import type { ToolDefinition, ToolPosition } from '../plugin-api';
import { loadLayout, saveLayout } from './layout-storage';

const directions: Record<Exclude<ToolPosition, 'center'>, 'left' | 'right' | 'below' | 'within'> = {
  left: 'left',
  right: 'right',
  below: 'below',
  within: 'within',
};

function addPanel(api: DockviewApi, tool: ToolDefinition, background: boolean): void {
  const position = tool.defaultPosition ?? 'center';
  const reference = (tool.defaultReference && api.getPanel(tool.defaultReference)) || api.activePanel;
  api.addPanel({
    id: tool.id,
    component: tool.id,
    title: tool.title,
    inactive: background && Boolean(reference),
    ...(position !== 'center' && reference
      ? { position: { referencePanel: reference.id, direction: directions[position] } }
      : {}),
  });
}

/** Opens a tool's panel, or brings it to the front when it is already open. */
export function openTool(api: DockviewApi, tool: ToolDefinition): void {
  const existing = api.getPanel(tool.id);
  if (existing) existing.api.setActive();
  else addPanel(api, tool, false);
}

/** Brings an open tool to the front; does nothing when it is closed. */
export function showTool(api: DockviewApi, id: string): void {
  api.getPanel(id)?.api.setActive();
}

export function openDefaultTools(api: DockviewApi, tools: readonly ToolDefinition[]): void {
  api.clear();
  tools.filter((tool) => tool.openByDefault).forEach((tool) => addPanel(api, tool, Boolean(tool.openInBackground)));
}

/**
 * A tab with its title and a close mark. The mark is for the mouse; the
 * keyboard closes the tab with Delete, so no button sits inside the tab.
 */
function ToolTab({ api }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title ?? '');
  useEffect(() => {
    const listener = api.onDidTitleChange((event) => setTitle(event.title));
    return () => listener.dispose();
  }, [api]);

  useEffect(() => {
    // Dockview puts role="tab" on the element around this one.
    const tab = document.querySelector<HTMLElement>(`[data-tool-tab="${CSS.escape(api.id)}"]`)?.closest<HTMLElement>('[role="tab"]');
    if (!tab) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      event.preventDefault();
      api.close();
    };
    tab.title = `${title} (Delete closes it)`;
    tab.addEventListener('keydown', onKey);
    return () => tab.removeEventListener('keydown', onKey);
  }, [api, title]);

  return (
    <div
      className="dv-default-tab"
      data-tool-tab={api.id}
      onPointerUp={(event) => event.button === 1 && api.close()}
    >
      <span className="dv-default-tab-content">{title}</span>
      <span
        aria-hidden
        className="dv-default-tab-action"
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation();
          api.close();
        }}
      >
        <X className="size-3" />
      </span>
    </div>
  );
}

interface WorkspaceProps {
  tools: readonly ToolDefinition[];
  onReady: (api: DockviewApi) => void;
}

/** The dockable workspace: every tool is a panel users can dock, split or float. */
export function Workspace({ tools, onReady }: WorkspaceProps) {
  const components = useMemo(() => {
    const map: Record<string, FunctionComponent<IDockviewPanelProps>> = {};
    for (const tool of tools) {
      const Tool = tool.component;
      map[tool.id] = () => <Tool />;
    }
    return map;
  }, [tools]);

  function ready({ api }: DockviewReadyEvent) {
    const saved = loadLayout();
    let restored = false;
    if (saved) {
      try {
        api.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]);
        restored = api.panels.length > 0;
      } catch {
        restored = false;
      }
    }
    if (!restored) {
      openDefaultTools(api, tools);
    }
    api.onDidLayoutChange(() => saveLayout(api.toJSON()));
    onReady(api);
  }

  return (
    <DockviewReact
      className="dockview-theme-chili h-full"
      components={components}
      defaultTabComponent={ToolTab}
      onReady={ready}
    />
  );
}
