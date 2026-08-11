import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';

// Markdown source editor (body only; the frontmatter stays intact and is not
// editable in this phase). Light/dark theme following the system.
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

export default function Editor({ value, onChange, readOnly = false }) {
  const dark = useDark();
  const extensions = useMemo(
    () => [markdown(), EditorView.lineWrapping],
    []
  );
  return (
    <div className="editor-wrap">
      <CodeMirror
        value={value}
        theme={dark ? 'dark' : 'light'}
        extensions={extensions}
        onChange={onChange}
        // `editable`, not `readOnly`: both block typing, but `readOnly` keeps
        // the caret and the focus ring, which invite an edit that cannot land.
        // Selecting and copying still work either way.
        editable={!readOnly}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        minHeight="60vh"
        style={{ fontSize: '15px' }}
      />
    </div>
  );
}
