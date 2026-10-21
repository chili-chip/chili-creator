// The workspace layout is a per-viewer convenience: losing it only means the
// default layout comes back, so storage errors are swallowed.

export const LAYOUT_KEY = 'chili.creator.layout.v3';

export function loadLayout(): unknown {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLayout(layout: unknown): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Private windows and blocked storage: keep the layout for this visit only.
  }
}

export function clearLayout(): void {
  try {
    localStorage.removeItem(LAYOUT_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
