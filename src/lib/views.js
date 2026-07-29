// Evaluator for Tolaria views (.yml): all/any filters with field/op/value + sort.

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function getField(note, field) {
  switch (field) {
    case 'type': return note.type;
    case 'title': return note.title;
    case 'body': return note.body;
    case 'status': return note.frontmatter.status ?? note.frontmatter.Status;
    case 'favorite': return note.frontmatter.favorite;
    default: return note.frontmatter[field];
  }
}

function testOp(fieldVal, op, value) {
  const arr = asArray(fieldVal);
  switch (op) {
    case 'equals': return arr.some((x) => x === value);
    case 'not_equals': return !arr.some((x) => x === value);
    case 'contains': return arr.some((x) => x.includes(value));
    case 'not_contains': return !arr.some((x) => x.includes(value));
    case 'any_of': return arr.some((x) => (value || []).includes(x));
    case 'none_of': return !arr.some((x) => (value || []).includes(x));
    case 'is_empty': return arr.length === 0 || arr.every((x) => x === '');
    case 'is_not_empty': return arr.some((x) => x !== '');
    case 'before': return arr.some((x) => x < value);
    case 'after': return arr.some((x) => x > value);
    default: return true;
  }
}

function evalNode(note, node) {
  if (node.all) return node.all.every((c) => evalNode(note, c));
  if (node.any) return node.any.some((c) => evalNode(note, c));
  return testOp(getField(note, node.field), node.op, node.value);
}

function parseSort(spec) {
  if (!spec) return null;
  const parts = String(spec).split(':');
  if (parts[0] === 'property') return { kind: 'property', name: parts[1], dir: parts[2] || 'asc' };
  return { kind: parts[0], dir: parts[1] || 'asc' };
}

function sortKey(note, s) {
  switch (s.kind) {
    case 'modified': return note.mtime;
    case 'created': return note.ctime;
    case 'title': return (note.title || '').toLowerCase();
    case 'status': return String(note.frontmatter.status ?? note.frontmatter.Status ?? '').toLowerCase();
    case 'property': {
      const v = note.frontmatter[s.name];
      if (v == null) return '';
      return typeof v === 'number' ? v : String(v).toLowerCase();
    }
    default: return note.mtime;
  }
}

export function sortNotes(list, spec) {
  const s = parseSort(spec);
  if (!s) return list;
  const out = [...list].sort((a, b) => {
    const ka = sortKey(a, s), kb = sortKey(b, s);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return s.dir === 'desc' ? out.reverse() : out;
}

export function filterNotes(list, view) {
  const filtered = view.filters ? list.filter((n) => evalNode(n, view.filters)) : list.slice();
  return sortNotes(filtered, view.sort);
}
