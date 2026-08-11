// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// What preferences RENDERS (adr/0034). The storage itself is covered by
// lib/prefs.test.js and the label building by lib/localeLabels.test.js; this
// file asserts the two properties that are decisions rather than plumbing —
// the notice is conditional, and the token can never be typed in.

vi.mock('../content.js', () => ({ build: null, notes: [], titleIndex: {}, idTitle: {}, maps: {} }));

let caps = { canWrite: false, known: true };
vi.mock('../lib/capabilities.js', () => ({
  useCapabilities: () => caps,
  loadCapabilities: () => {},
}));

const { default: Preferences } = await import('./Preferences.jsx');
const { __test } = await import('../lib/prefs.js');
const { SUPPORTED_LOCALES, FORMAT_LOCALES } = await import('../lib/locale.js');

const render = () => renderToStaticMarkup(<Preferences onClose={() => {}} />);

beforeEach(() => {
  __test.reset();
  caps = { canWrite: false, known: true };
});

describe('preferences modal', () => {
  it('never offers a way to type the token in', () => {
    // The one thing this surface must not grow. It is a server-side secret, and
    // a field here would invite pasting it into a page that cannot use it.
    for (const state of [
      { canWrite: false, known: true },
      { canWrite: true, known: true },
      { canWrite: false, known: false },
    ]) {
      caps = state;
      const html = render();
      expect(html).not.toContain('<input');
      expect(html).not.toContain('type="password"');
    }
  });

  it('explains itself when the deployment cannot commit', () => {
    caps = { canWrite: false, known: true };
    expect(render()).toContain('Editing is off');
  });

  it('says nothing about the token when the deployment can commit', () => {
    caps = { canWrite: true, known: true };
    expect(render()).not.toContain('Editing is off');
  });

  it('says nothing about the token before the deployment has answered', () => {
    // An unanswered endpoint must not accuse a deployment that writes perfectly
    // well — silence is the honest state, not a warning.
    caps = { canWrite: false, known: false };
    expect(render()).not.toContain('Editing is off');
  });

  it('offers Auto plus one entry per shipped catalogue', () => {
    const html = render();
    expect(html).toContain('System default');
    for (const code of SUPPORTED_LOCALES) {
      expect(html).toContain(`value="${code}"`);
    }
  });

  it('offers Auto plus every curated format', () => {
    const html = render();
    for (const tag of FORMAT_LOCALES) {
      expect(html).toContain(`value="${tag}"`);
    }
  });

  it('relabels the format entries when the language changes, without moving the format preference', async () => {
    // Criterion 4: the two selectors are independent in VALUE, while the region
    // names follow the interface language — they are read by whoever is reading
    // the rest of the modal.
    const { setLocale } = await import('../lib/i18n.js');
    __test.seed({ formatLocale: 'en-GB' });
    expect(render()).toContain('United Kingdom');
    setLocale('it');
    const italian = render();
    setLocale('en');
    expect(italian).toContain('Regno Unito');
    // The stored choice is untouched by the relabelling.
    expect(__test.KEY && JSON.parse(localStorage.getItem(__test.KEY)).formatLocale).toBe('en-GB');
  });

  it('shows Inbox as on when nothing is stored', () => {
    expect(render()).toContain('aria-checked="true"');
  });

  it('reflects a stored Inbox preference', () => {
    __test.seed({ showInbox: false });
    expect(render()).toContain('aria-checked="false"');
  });
});
