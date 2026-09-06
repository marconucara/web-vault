// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';

// The base a draft carries (adr/0050-*.md). This is the link in the chain that
// is invisible when it breaks: with no base the commit is simply not checked,
// and a note changed elsewhere is overwritten exactly as it was before any of
// this existed. So the store is pinned on carrying it, and on keeping it.

async function freshStore() {
  localStorage.clear();
  vi.resetModules();
  return import('./pending.js');
}

const note = (over = {}) => ({
  id: 'n',
  path: 'n.md',
  title: 'N',
  body: 'original\n',
  baseSha: 'blobBASE',
  ...over,
});

describe('the base a pending edit carries', () => {
  beforeEach(() => localStorage.clear());

  it('records the base of the note the edit started from', async () => {
    const { setEdit, usePending, ...store } = await freshStore();
    setEdit(note(), 'edited\n');
    const state = JSON.parse(localStorage.getItem('vault-web:pending:v1'));
    expect(state['n.md'].baseSha).toBe('blobBASE');
  });

  it('keeps the ORIGINAL base across later keystrokes', async () => {
    // The case that matters most. A rebuild can land while a draft is open, and
    // the note object handed to setEdit then carries a newer base. Adopting it
    // would silently re-point the draft at content the user never saw — and the
    // commit would sail through against a version they never read.
    const { setEdit } = await freshStore();
    setEdit(note(), 'first edit\n');
    setEdit(note({ baseSha: 'blobNEWER' }), 'second edit\n');
    const state = JSON.parse(localStorage.getItem('vault-web:pending:v1'));
    expect(state['n.md'].baseSha).toBe('blobBASE');
    expect(state['n.md'].body).toBe('second edit\n');
  });

  it('survives a reload', async () => {
    const { setEdit } = await freshStore();
    setEdit(note(), 'edited\n');
    // A new module instance reading the same localStorage: what a reload does.
    vi.resetModules();
    const { usePending } = await import('./pending.js');
    const reloaded = JSON.parse(localStorage.getItem('vault-web:pending:v1'));
    expect(reloaded['n.md'].baseSha).toBe('blobBASE');
  });

  it('is null, not undefined, for a note that has no base', async () => {
    // An untracked note, or a build predating the field. The commit treats it as
    // "do not check" — but the key must exist so the shape stays predictable.
    const { setEdit } = await freshStore();
    setEdit(note({ baseSha: undefined }), 'edited\n');
    const state = JSON.parse(localStorage.getItem('vault-web:pending:v1'));
    expect(state['n.md'].baseSha).toBe(null);
  });

  it('starts over when the draft is discarded and the note is edited again', async () => {
    // Discard drops the entry, so the next edit re-reads the base from the note
    // as it stands then — which by that point may legitimately be a newer one.
    const { setEdit, discard } = await freshStore();
    setEdit(note(), 'edited\n');
    discard('n.md');
    setEdit(note({ baseSha: 'blobNEWER' }), 'edited again\n');
    const state = JSON.parse(localStorage.getItem('vault-web:pending:v1'));
    expect(state['n.md'].baseSha).toBe('blobNEWER');
  });
});
