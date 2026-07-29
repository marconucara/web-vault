import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
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

export default function Editor({ value, onChange }) {
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
