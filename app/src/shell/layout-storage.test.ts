import { describe, expect, it, vi } from 'vitest';
import { loadLayout, saveLayout, LAYOUT_KEY } from './layout-storage';

describe('layout storage', () => {
  it('saves and loads a layout', () => {
    saveLayout({ grid: { root: 1 } });
    expect(loadLayout()).toEqual({ grid: { root: 1 } });
  });

  it('returns null for a missing or broken layout', () => {
    expect(loadLayout()).toBeNull();
    localStorage.setItem(LAYOUT_KEY, '{not json');
    expect(loadLayout()).toBeNull();
  });

  it('keeps working when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadLayout()).toBeNull();
    expect(() => saveLayout({})).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
