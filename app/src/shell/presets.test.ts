import type { DockviewApi } from 'dockview-react';
import { describe, expect, it, vi } from 'vitest';
import { builtInTools as tools } from '../tools';
import { applyPreset, layoutPresets } from './presets';

/** Just enough of Dockview to record what a preset opens and where. */
function fakeDock() {
  const panels: { id: string; position?: { referencePanel: string; direction: string }; inactive?: boolean }[] = [];
  const api = {
    clear: vi.fn(() => void panels.splice(0)),
    addPanel: vi.fn((panel: (typeof panels)[number]) => void panels.push(panel)),
    getPanel: (id: string) => panels.find((p) => p.id === id),
    get activePanel() {
      return panels.at(-1);
    },
    get panels() {
      return panels;
    },
  };
  return { api: api as unknown as DockviewApi, panels };
}

describe('layout presets', () => {
  it('offers the everything, drawing, writing, sound and playtest layouts', () => {
    expect(layoutPresets.map((p) => p.title)).toEqual(['Everything', 'Drawing', 'Writing', 'Sound', 'Playtest']);
  });

  it('lays out drawing as room, paint beside it and the library under paint', () => {
    const { api, panels } = fakeDock();
    applyPreset(api, 'draw', tools);
    expect(api.clear).toHaveBeenCalled();
    expect(panels.map((p) => [p.id, p.position?.direction ?? 'center', p.position?.referencePanel ?? null])).toEqual([
      ['room', 'center', null],
      ['paint', 'right', 'room'],
      ['library', 'below', 'paint'],
      ['colors', 'within', 'library'],
    ]);
    expect(panels.find((p) => p.id === 'colors')!.inactive).toBe(true);
  });

  it('opens every default tool for the everything layout', () => {
    const { api, panels } = fakeDock();
    applyPreset(api, 'default', tools);
    expect(panels.map((p) => p.id)).toEqual(tools.filter((t) => t.openByDefault).map((t) => t.id));
  });

  it('skips tools that are not registered', () => {
    const { api, panels } = fakeDock();
    applyPreset(
      api,
      'sound',
      tools.filter((t) => t.id !== 'blips'),
    );
    expect(panels.map((p) => p.id)).toEqual(['room', 'tunes']);
  });
});
