// Harness: round-trips the body of every real note through the richMarkdown layer
// and reports how many come back identical plus the diffs of the ones that differ.
// Dev-only, used to validate BlockNote's round-trip; it is not part of the build.
import data from 'virtual:web-vault-content';
import { roundTripBody } from './lib/richMarkdown.js';

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const ctx = 40;
  return {
    at: i,
    orig: JSON.stringify(a.slice(Math.max(0, i - ctx), i + ctx)),
    rt: JSON.stringify(b.slice(Math.max(0, i - ctx), i + ctx)),
  };
}

// Normalize the "acceptable" differences: leading/trailing newlines (BlockNote
// drops the blank line after the frontmatter). Isolates the STRUCTURAL diffs.
const norm = (s) => s.replace(/^\n+/, '').replace(/\s+$/, '');

async function run() {
  const notes = data.notes.filter((n) => n.type !== 'Type');
  const results = [];
  for (const n of notes) {
    let rt = null;
    let error = null;
    try {
      rt = await roundTripBody(n.body);
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    }
    const a = norm(n.body);
    const b = rt == null ? '' : norm(rt);
    const equal = rt != null && a === b;
    results.push({
      path: n.path,
      equal,
      error,
      origLen: a.length,
      rtLen: b.length,
      diff: equal || rt == null ? null : firstDiff(a, b),
    });
  }
  const ok = results.filter((r) => r.equal).length;
  const errs = results.filter((r) => r.error).length;
  window.__results = results;
  document.getElementById('summary').textContent =
    `notes: ${results.length} | identical: ${ok} | different: ${results.length - ok} | errors: ${errs}`;

  const diffs = results.filter((r) => !r.equal);
  document.getElementById('diffs').innerHTML = diffs
    .slice(0, 60)
    .map((r) => {
      if (r.error) return `<hr><b>${r.path}</b> — ERROR: ${r.error}`;
      return `<hr><b>${r.path}</b> (orig ${r.origLen} → rt ${r.rtLen}), first diff @${r.diff.at}<br>` +
        `orig: <code>${escapeHtml(r.diff.orig)}</code><br>rt&nbsp;&nbsp;: <code>${escapeHtml(r.diff.rt)}</code>`;
    })
    .join('');
  window.__done = true;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

run();
