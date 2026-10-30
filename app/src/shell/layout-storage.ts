// The workspace layout is a per-viewer convenience: losing it only means the
// default layout comes back, so storage errors are swallowed.

export const LAYOUT_KEY = 'chili.creator.layout.v5';

/** Each editor keeps its own layout. Bitsy's keeps the key it always had. */
export function layoutKey(editor = 'bitsy'): string {
  return editor === 'bitsy' ? LAYOUT_KEY : `${LAYOUT_KEY}.${editor}`;
}

export function loadLayout(editor?: string): unknown {
  try {
    const raw = localStorage.getItem(layoutKey(editor));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLayout(layout: unknown, editor?: string): void {
  try {
    localStorage.setItem(layoutKey(editor), JSON.stringify(layout));
  } catch {
    // Private windows and blocked storage: keep the layout for this visit only.
  }
}

export function clearLayout(editor?: string): void {
  try {
    localStorage.removeItem(layoutKey(editor));
  } catch {
    // Nothing stored to clear.
  }
}
