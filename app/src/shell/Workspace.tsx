import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react';
import { useMemo, type FunctionComponent } from 'react';
import type { ToolDefinition, ToolPosition } from '../plugin-api';
import { loadLayout, saveLayout } from './layout-storage';

const directions: Record<Exclude<ToolPosition, 'center'>, 'left' | 'right' | 'below'> = {
  left: 'left',
  right: 'right',
  below: 'below',
};

/** Opens a tool's panel, or brings it to the front when it is already open. */
export function openTool(api: DockviewApi, tool: ToolDefinition): void {
  const existing = api.getPanel(tool.id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const position = tool.defaultPosition ?? 'center';
  const reference = api.activePanel;
  api.addPanel({
    id: tool.id,
    component: tool.id,
    title: tool.title,
    ...(position !== 'center' && reference
      ? { position: { referencePanel: reference.id, direction: directions[position] } }
      : {}),
  });
}

export function openDefaultTools(api: DockviewApi, tools: readonly ToolDefinition[]): void {
  api.clear();
  tools.filter((tool) => tool.openByDefault).forEach((tool) => openTool(api, tool));
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
      onReady={ready}
    />
  );
}
