import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { en as blockNoteEn, it as blockNoteIt } from '@blocknote/core/locales';
import { useTranslation } from 'react-i18next';
import { loadBodyIntoEditor, serializeEditorBody } from '../lib/richMarkdown.js';
import { schema } from '../lib/blocknoteSchema.jsx';
import { anchorOf, noteHash } from '../lib/headingSlug.js';
import { refreshHeadingAnchors, isCopyIconHit, lastLineRect, copyHeadingLink } from '../lib/headingAnchors.js';

function useDark() {
  const [dark, setDark] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

// WYSIWYG block editor (BlockNote). Initialized from the note's markdown body,
// re-serializes to markdown (vault style) on every change, debounced.
// Mount with key={note.id} so each note starts from a clean editor.
// `newNote`: a brand-new note with no title yet — an empty markdown heading
// (`# `) does not round-trip through the parser as an editable heading block, so
// we seed a real empty H1 and focus it, ready for the title.
// The editor's own chrome — slash menu, formatting toolbar, placeholders — is
// BlockNote's, not ours, and it is the largest surface in the app. Leaving it in
// English while everything around it translates would read as a half-done job,
// so the resolved interface language selects BlockNote's shipped dictionary.
// Falling back to English for a language BlockNote does not ship is correct
// here, and different from our own missing-key rule: this catalogue is not ours
// to complete, so there is no gap for anyone to act on.
//
// Named imports rather than `import * as`: BlockNote ships 23 dictionaries and a
// namespace import puts all of them in this chunk, which is the editor's own
// lazily-loaded one. Only the languages we have a catalogue for can ever be
// selected, so the rest are dead weight on the slowest load in the app.
const BLOCKNOTE_DICTIONARIES = { en: blockNoteEn, it: blockNoteIt };

function blockNoteDictionary(language) {
  return BLOCKNOTE_DICTIONARIES[language] || blockNoteEn;
}

export default function BlockEditor({ value, onChange, noteId = null, newNote = false, readOnly = false }) {
  const { i18n } = useTranslation();
  // Keyed by note id at the call site, so a language change reaches the editor
  // on the next note rather than remounting the one being typed in.
  const editor = useCreateBlockNote({ schema, dictionary: blockNoteDictionary(i18n.language) });
  const dark = useDark();
  const readyRef = useRef(false);
  const timerRef = useRef(null);
  const rootRef = useRef(null);


  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    (async () => {
      if (newNote) {
        editor.replaceBlocks(editor.document, [{ type: 'heading', props: { level: 1 }, content: [] }]);
        requestAnimationFrame(() => {
          if (cancelled) return;
          try {
            editor.focus();
            const first = editor.document[0];
            if (first) editor.setTextCursorPosition(first, 'end');
          } catch {
            // focus is best-effort
          }
        });
      } else {
        await loadBodyIntoEditor(editor, value);
      }
      if (cancelled) return;
      readyRef.current = true;
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Load only on editor mount (initial value); later changes come from the
    // user, we do not reload so we don't overwrite the editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // A bare `#some-heading` link, as an author writes it, cannot be followed as
  // it stands: assigning it to `window.location.hash` replaces the whole hash,
  // so the note id is lost and the note closes. It is rewritten against the
  // open note into `#/n/<id>#<slug>` — which is also what makes the address
  // survive a reload and mean the same thing to someone it is sent to.
  //
  // Caught in the capture phase on the editor root, ahead of BlockNote's own
  // link handler: that one calls `window.open(href, '_blank')`, which for a
  // bare anchor would open an empty tab. Chips are untouched — they carry their
  // own handlers (src/lib/chipClick.js) and never have a bare-anchor href.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;

      // The copy-link icon on a heading. It is a `::after`, so it is never the
      // event target — the click arrives as the heading and is placed by
      // geometry. Handled before the anchor case below because a heading is not
      // an `<a>`, and in the capture phase so it lands ahead of ProseMirror
      // putting the caret where the user clicked.
      //
      // H1 is excluded, matching the stylesheet: it is the note title, which
      // `#/n/<id>` already addresses, and the icon is bulky at that size. The
      // title still carries an `id`, so an anchor to it resolves — only the
      // affordance is absent.
      const heading = e.target?.closest?.('[data-content-type="heading"] > :is(h2,h3,h4,h5,h6)[id]');
      if (heading && root.contains(heading)) {
        const size = parseFloat(getComputedStyle(heading).fontSize) || 16;
        if (isCopyIconHit(e.clientX, e.clientY, lastLineRect(heading), size)) {
          e.preventDefault();
          e.stopPropagation();
          copyHeadingLink(heading, noteId);
          return;
        }
      }

      const a = e.target?.closest?.('a[href]');
      if (!a || !root.contains(a)) return;
      const anchor = anchorOf(a.getAttribute('href'));
      if (!anchor || !noteId) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.hash = noteHash(noteId, anchor);
    };
    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }, [noteId]);

  const handleChange = () => {
    if (!readyRef.current) return;
    // Typing into a heading does not re-run its `render`, so the anchor is
    // refreshed here — undebounced, unlike the serialization below, since it is
    // only a string compare per heading.
    refreshHeadingAnchors(rootRef.current, editor.document);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const md = await serializeEditorBody(editor);
      onChange(md);
    }, 300);
  };

  return (
    <div className="blockeditor" ref={rootRef}>
      {/* `editable` toggles typing without changing what is rendered, so the
          block heights — and the heading ids the anchor scroll is chasing — are
          the same in both states (adr/0034 criterion 10). */}
      <BlockNoteView editor={editor} onChange={handleChange} theme={dark ? 'dark' : 'light'} editable={!readOnly} />
    </div>
  );
}
