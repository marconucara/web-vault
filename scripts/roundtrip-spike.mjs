#!/usr/bin/env node
// Measures richMarkdown round-trip fidelity against the generated content.json.
// Diagnostic only: not part of the fast verify gate because it scales with vault
// size and exists to record rollout evidence for ADR 0041.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { CONTENT_JSON } from './paths.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const spikeStubPlugin = {
  name: 'web-vault-spike-stubs',
  enforce: /** @type {'pre'} */ ('pre'),
  resolveId(source) {
    if (source === 'virtual:web-vault-content') return '\0virtual:web-vault-content-spike';
    if (source.endsWith('/components/Icon.jsx') || source === '../components/Icon.jsx') return '\0web-vault-icon-spike';
    if (source.endsWith('/components/MapCard.jsx') || source === '../components/MapCard.jsx') return '\0web-vault-mapcard-spike';
    return undefined;
  },
  load(id) {
    if (id === '\0virtual:web-vault-content-spike') {
      return 'export default { notes: [], views: [], types: [], typeMeta: {}, titleIndex: {}, idTitle: {}, notesById: {}, build: {} };';
    }
    if (id === '\0web-vault-icon-spike') return 'export default function Icon(){ return null; }';
    if (id === '\0web-vault-mapcard-spike') return 'export default function MapCard(){ return null; }';
    return undefined;
  },
};

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  const ctx = 40;
  return {
    at: i,
    orig: JSON.stringify(a.slice(Math.max(0, i - ctx), i + ctx)),
    rt: JSON.stringify(b.slice(Math.max(0, i - ctx), i + ctx)),
  };
}

const norm = (s) => String(s || '').replace(/^\n+/, '').replace(/\s+$/, '');
const content = JSON.parse(readFileSync(CONTENT_JSON, 'utf8'));
const notes = (content.notes || []).filter((n) => n.type !== 'Type');
const server = await createServer({
  configFile: false,
  plugins: [spikeStubPlugin, react()],
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { roundTripBody } = await server.ssrLoadModule('/src/lib/richMarkdown.js');
  const results = [];
  for (const note of notes) {
    let rt = null;
    let error = null;
    try {
      rt = await roundTripBody(note.body || '');
    } catch (e) {
      error = e && e.message ? e.message : String(e);
    }
    const orig = norm(note.body);
    const got = norm(rt);
    const equal = error == null && orig === got;
    results.push({ path: note.path, equal, error, diff: equal || error ? null : firstDiff(orig, got) });
  }

  const failed = results.filter((r) => !r.equal);
  const errors = results.filter((r) => r.error);
  console.log(JSON.stringify({
    notes: results.length,
    failed: failed.length,
    errors: errors.length,
    sampleFailures: failed.slice(0, 10),
  }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await server.close();
}
