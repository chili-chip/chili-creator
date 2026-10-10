// Finds the local scripts and stylesheets editor/index.html loads.
export function assetRefs(html) {
  const refs = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/g)) {
    const tag = match[0];
    if (match[1] === 'link' && !/\brel="stylesheet"/.test(tag)) {
      continue;
    }
    const attr = /\b(?:src|href)="([^"]+)"/.exec(tag);
    if (!attr) {
      continue;
    }
    const ref = attr[1];
    if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('#') || ref === '') {
      continue;
    }
    refs.push({ ref, attr: { index: match.index + attr.index, text: attr[0] } });
  }
  return refs;
}
