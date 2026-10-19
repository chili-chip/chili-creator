/**
 * The classic editor ships next to the new one (`dist/` and `editor/` in the
 * package, `/creator/app/` and `/creator/editor/` on the platform). Keep the
 * query (api, project) so the same game opens there.
 */
export function classicEditorUrl(search = typeof location === 'undefined' ? '' : location.search): string {
  return `../editor/index.html${search}`;
}
