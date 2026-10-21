import type { DockviewApi } from 'dockview-react';
import type { ToolDefinition } from '../plugin-api';
import { openDefaultTools } from './Workspace';

interface PresetPanel {
  tool: string;
  /** Where it goes beside `reference`; the first panel fills the workspace. */
  position?: 'left' | 'right' | 'below' | 'within';
  reference?: string;
  /** Opens as a tab behind the others. */
  background?: boolean;
}

export interface LayoutPreset {
  id: string;
  title: string;
  /** null: every tool that opens by default, where it opens by default. */
  panels: PresetPanel[] | null;
}

export const layoutPresets: LayoutPreset[] = [
  { id: 'default', title: 'Everything', panels: null },
  {
    id: 'draw',
    title: 'Drawing',
    panels: [
      { tool: 'room' },
      { tool: 'paint', position: 'right', reference: 'room' },
      { tool: 'library', position: 'below', reference: 'paint' },
      { tool: 'colors', position: 'within', reference: 'library', background: true },
    ],
  },
  {
    id: 'write',
    title: 'Writing',
    panels: [
      { tool: 'room' },
      { tool: 'dialog', position: 'right', reference: 'room' },
      { tool: 'exits', position: 'within', reference: 'dialog', background: true },
      { tool: 'variables', position: 'within', reference: 'dialog', background: true },
      { tool: 'play', position: 'below', reference: 'room', background: true },
    ],
  },
  {
    id: 'sound',
    title: 'Sound',
    panels: [
      { tool: 'room' },
      { tool: 'tunes', position: 'right', reference: 'room' },
      { tool: 'blips', position: 'within', reference: 'tunes', background: true },
    ],
  },
  {
    id: 'play',
    title: 'Playtest',
    panels: [
      { tool: 'play' },
      { tool: 'room', position: 'right', reference: 'play' },
      { tool: 'problems', position: 'below', reference: 'room' },
    ],
  },
];

/** Replaces the workspace with a preset. Tools that are not registered are left out. */
export function applyPreset(api: DockviewApi, id: string, tools: readonly ToolDefinition[]): void {
  const preset = layoutPresets.find((p) => p.id === id);
  if (!preset) return;
  if (!preset.panels) {
    openDefaultTools(api, tools);
    return;
  }
  api.clear();
  for (const panel of preset.panels) {
    const tool = tools.find((t) => t.id === panel.tool);
    if (!tool) continue;
    const reference = panel.reference && api.getPanel(panel.reference);
    api.addPanel({
      id: tool.id,
      component: tool.id,
      title: tool.title,
      inactive: Boolean(panel.background && reference),
      ...(panel.position && reference ? { position: { referencePanel: reference.id, direction: panel.position } } : {}),
    });
  }
}
