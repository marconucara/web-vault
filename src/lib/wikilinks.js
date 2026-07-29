const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Converts the body's [[wikilinks]] into markdown links to the in-app hash routes.
// Unresolved targets stay plain text. Without an alias, the displayed text is the
// note title (links are in path form `folder/filename`), not the path.
export function transformWikilinks(md, titleIndex, idTitle = {}) {
  return md.replace(WIKILINK, (_m, target, alias) => {
    const id = titleIndex[target.trim().toLowerCase()];
    const text = (alias || (id && idTitle[id]) || target).trim();
    return id ? `[${text}](#/n/${encodeURIComponent(id)})` : text;
  });
}

// Extracts wikilink targets from a frontmatter value (string or list).
export function wikilinkTargets(value, titleIndex, idTitle = {}) {
  const arr = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    let m;
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(v))) {
      const target = m[1].trim();
      const id = titleIndex[target.toLowerCase()] || null;
      out.push({ text: (m[2] || (id && idTitle[id]) || target).trim(), id });
    }
  }
  return out;
}
