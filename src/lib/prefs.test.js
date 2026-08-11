// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { __test, getPrefs, setPref } from './prefs.js';

// Client preference storage (adr/0034-client-settings-modal.md).
//
// The load in prefs.js runs at import time, so these tests drive the store
// through its own API rather than by writing localStorage and re-importing.

beforeEach(() => {
  __test.reset();
});

describe('preference storage', () => {
  it('starts empty, which is what "System default" looks like', () => {
    expect(getPrefs()).toEqual({});
  });

  it('stores a chosen value', () => {
    setPref('locale', 'it');
    expect(getPrefs().locale).toBe('it');
    expect(localStorage.getItem(__test.KEY)).toContain('it');
  });

  // The point of the whole design: "Auto" must be an ABSENT key, never a stored
  // sentinel. A `"auto"` string would satisfy every other test in this file and
  // still pin the language of a user who never chose one — the moment they
  // changed their browser, the app would keep the language it had guessed.
  it('removes the key when the choice goes back to Auto', () => {
    setPref('locale', 'it');
    setPref('locale', null);
    expect('locale' in getPrefs()).toBe(false);
    expect(JSON.parse(localStorage.getItem(__test.KEY))).toEqual({});
  });

  it('treats undefined as a removal too', () => {
    setPref('formatLocale', 'en-GB');
    setPref('formatLocale', undefined);
    expect('formatLocale' in getPrefs()).toBe(false);
  });

  it('keeps the other preferences when one is cleared', () => {
    setPref('locale', 'it');
    setPref('formatLocale', 'en-GB');
    setPref('locale', null);
    expect(getPrefs()).toEqual({ formatLocale: 'en-GB' });
  });

  it('stores `false` for the Inbox toggle without confusing it with absence', () => {
    setPref('showInbox', false);
    expect(getPrefs().showInbox).toBe(false);
    // Absent means shown, so `false` has to survive the round trip as `false`
    // rather than being dropped as falsy.
    expect(JSON.parse(localStorage.getItem(__test.KEY))).toEqual({ showInbox: false });
  });

  it('survives a corrupted stored value', () => {
    localStorage.setItem(__test.KEY, '{not json');
    // The store already loaded; what matters is that a write still works and
    // replaces the damaged record rather than throwing.
    setPref('locale', 'en');
    expect(getPrefs().locale).toBe('en');
  });

  it('notifies subscribers on every change, and stops after unsubscribe', () => {
    let calls = 0;
    // The path `usePrefs` takes: a missed notification leaves the modal showing
    // a stale selection right after its own click.
    const unsub = __test.subscribe(() => { calls += 1; });
    setPref('locale', 'it');
    setPref('locale', null);
    unsub();
    setPref('locale', 'en');
    expect(calls).toBe(2);
  });
});
