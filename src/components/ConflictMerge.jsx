import React, { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { useTranslation } from 'react-i18next';

// The two-column diff for one drifted note (adr/0050-*.md).
//
// Left is what will be saved and is editable; right is what the branch holds and
// is not. Differences are highlighted, and each one carries a revert control
// that copies the server's version of that hunk into the left-hand text.
//
// The arrows only ever point LEFT (`revertControls: 'b-to-a'`), because keeping
// your own version needs no action — it is already what the left pane holds. A
// deletion made on the server is not a special case in this model: it is a hunk
// whose right-hand side is empty, and applying it removes those lines on the
// left, which is what "take theirs" has to mean for it to be complete.
//
// A hand-written diff would have to re-derive its hunks on every keystroke in
// the editable pane, and place an applied hunk correctly after the text around
// it has moved. That re-mapping is the part that goes wrong, and it is what this
// library is here for — not the colours.

/** Follows the system theme the way Editor.jsx does. */
function useDark() {
  const [dark, setDark] = React.useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export default function ConflictMerge({ value, remote, onChange }) {
  const host = useRef(null);
  const view = useRef(null);
  const dark = useDark();
  const { t } = useTranslation();
  // Held in a ref so the editor is not torn down and rebuilt (losing the
  // caret, the scroll and the undo history) every time the text changes.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return undefined;
    const common = [
      markdown(),
      EditorView.lineWrapping,
      // The library's own strings go through CodeMirror's phrase mechanism, so
      // they are translated here rather than left English inside a translated
      // screen. `$` is its placeholder for the count and must survive.
      EditorState.phrases.of({
        '$ unchanged lines': t('conflict.unchangedLines'),
        'Revert this chunk': t('conflict.revertChunk'),
      }),
      EditorView.theme({
        '&': { fontSize: '12.5px' },
        // The outer element scrolls (see styles.css), so the editors grow to
        // their content instead of owning a viewport of their own.
        '.cm-content': { paddingBlock: '8px' },
      }),
    ];
    const merge = new MergeView({
      a: {
        doc: value,
        extensions: [
          ...common,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          }),
        ],
      },
      b: {
        doc: remote,
        extensions: [...common, EditorState.readOnly.of(true), EditorView.editable.of(false)],
      },
      parent: host.current,
      // Only b→a: see the note above on why one direction is enough.
      revertControls: 'b-to-a',
      highlightChanges: true,
      gutter: true,
      // A long note is mostly unchanged, and scrolling through identical text to
      // find the few differences is the work this screen exists to remove. The
      // margin is generous on purpose: this is a conflict to resolve, not a
      // patch to review, so each difference keeps enough surrounding text to be
      // placed in the note. Only runs long enough to be worth hiding collapse.
      collapseUnchanged: { margin: 6, minSize: 12 },
    });
    view.current = merge;
    return () => {
      merge.destroy();
      view.current = null;
    };
    // Rebuilt only when the note being resolved changes: `value` is the seed,
    // and later edits flow through the update listener rather than through here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, t]);

  return <div className={`conflict-merge${dark ? ' cm-dark' : ''}`} ref={host} />;
}
