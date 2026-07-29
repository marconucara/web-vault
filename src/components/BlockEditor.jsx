import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { loadBodyIntoEditor, serializeEditorBody } from '../lib/richMarkdown.js';
import { schema } from '../lib/blocknoteSchema.jsx';

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
export default function BlockEditor({ value, onChange, newNote = false }) {
  const editor = useCreateBlockNote({ schema });
  const dark = useDark();
  const readyRef = useRef(false);
  const timerRef = useRef(null);

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
      if (!cancelled) readyRef.current = true;
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Load only on editor mount (initial value); later changes come from the
    // user, we do not reload so we don't overwrite the editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const handleChange = () => {
    if (!readyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const md = await serializeEditorBody(editor);
      onChange(md);
    }, 300);
  };

  return (
    <div className="blockeditor">
      <BlockNoteView editor={editor} onChange={handleChange} theme={dark ? 'dark' : 'light'} />
    </div>
  );
}
