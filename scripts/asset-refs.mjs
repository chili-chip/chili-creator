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

// Returns the html with `?v=<version>` on every local script and stylesheet.
export function stampVersion(html, version) {
  let next = html;
  for (const { attr, ref } of assetRefs(html).reverse()) {
    const stamped = `${ref.split(/[?#]/)[0]}?v=${version}`;
    next = next.slice(0, attr.index) + attr.text.replace(ref, stamped) + next.slice(attr.index + attr.text.length);
  }
  return next;
}
