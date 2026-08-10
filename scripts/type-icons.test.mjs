import { describe, it, expect } from 'vitest';
import {
  exportName,
  usedIconNames,
  usedIconNamesFromFile,
  availableIconNames,
  renderIconModule,
  iconChunkName,
  ICON_CHUNKS,
  UI_LUCIDE_ICONS,
} from './type-icons.mjs';

const typeNote = (title, frontmatter) => ({ title, type: 'Type', frontmatter });

describe('exportName', () => {
  it('maps a kebab lucide name to its PascalCase export', () => {
    expect(exportName('file-text')).toBe('FileText');
    expect(exportName('list')).toBe('List');
    expect(exportName('circle-arrow-out-up-right')).toBe('CircleArrowOutUpRight');
  });

  it('capitalises leading digits groups the same way lucide does', () => {
    expect(exportName('badge-4k')).toBe('Badge4k');
  });
});

describe('usedIconNames', () => {
  it('collects the icons of the Type documents, plus the app UI ones', () => {
    const names = usedIconNames({
      notes: [
        typeNote('Person', { icon: 'user-round' }),
        typeNote('Project', { _icon: 'folder-git' }),
        { title: 'A note', type: 'Person', frontmatter: { icon: 'ignored' } },
      ],
    });
    expect(names).toEqual(['folder-git', 'list', 'user-round']);
  });

  it('ignores types with no icon and de-duplicates', () => {
    const names = usedIconNames({
      notes: [
        typeNote('A', { icon: 'star' }),
        typeNote('B', { icon: 'star' }),
        typeNote('C', {}),
        typeNote('D', { icon: '' }),
      ],
    });
    expect(names).toEqual(['list', 'star']);
  });

  it('is sorted, so the generated module is stable across builds', () => {
    const a = usedIconNames({ notes: [typeNote('A', { icon: 'zap' }), typeNote('B', { icon: 'anchor' })] });
    const b = usedIconNames({ notes: [typeNote('B', { icon: 'anchor' }), typeNote('A', { icon: 'zap' })] });
    expect(a).toEqual(b);
  });

  it('survives an empty or malformed content payload', () => {
    expect(usedIconNames({})).toEqual([...UI_LUCIDE_ICONS].sort());
    expect(usedIconNames(null)).toEqual([...UI_LUCIDE_ICONS].sort());
    expect(usedIconNamesFromFile('/nonexistent/content.json')).toEqual([...UI_LUCIDE_ICONS].sort());
  });
});

describe('renderIconModule', () => {
  it('emits a name -> component map that imports each icon statically', () => {
    const code = renderIconModule(['file-text', 'list'], new Set(['file-text', 'list']));
    expect(code).toContain("import FileText from 'lucide-react/dist/esm/icons/file-text.mjs';");
    expect(code).toContain("import List from 'lucide-react/dist/esm/icons/list.mjs';");
    expect(code).toContain('"file-text": FileText,');
    expect(code).toContain('"list": List,');
    expect(code).not.toContain('import(');
  });

  it('drops names lucide does not ship instead of breaking the build', () => {
    const code = renderIconModule(['list', 'not-a-real-icon'], new Set(['list']));
    expect(code).toContain('"list": List,');
    expect(code).not.toContain('not-a-real-icon');
  });

  it('is a valid module for every icon the app names by default', () => {
    const valid = availableIconNames();
    for (const name of UI_LUCIDE_ICONS) expect(valid.has(name)).toBe(true);
    expect(renderIconModule(usedIconNames({}))).toContain("icons/list.mjs'");
  });
});

describe('availableIconNames', () => {
  it('reads the installed lucide icon set', () => {
    const names = availableIconNames();
    expect(names.size).toBeGreaterThan(1000);
    expect(names.has('file-text')).toBe(true);
    expect(names.has('lucide-react')).toBe(false);
  });
});

describe('iconChunkName', () => {
  const idFor = (name) => `/repo/node_modules/lucide-react/dist/esm/icons/${name}.mjs`;

  it('groups an icon module into one of the buckets', () => {
    expect(iconChunkName(idFor('file-text'))).toMatch(/^lucide-\d{2}$/);
  });

  it('claims nothing that is not a lucide icon module', () => {
    expect(iconChunkName('/repo/src/components/Icon.jsx')).toBeUndefined();
    expect(iconChunkName('/repo/node_modules/lucide-react/dist/esm/lucide-react.mjs')).toBeUndefined();
    // The dynamic entry point itself must stay with the code that imports it.
    expect(iconChunkName('/repo/node_modules/lucide-react/dynamic.mjs')).toBeUndefined();
    // A path that merely contains the icons segment deeper in another package.
    expect(iconChunkName('/repo/node_modules/other/lucide-react/dist/esm/icons/x/y.mjs')).toBeUndefined();
  });

  it('is stable, so an unchanged icon set keeps its chunks cached', () => {
    expect(iconChunkName(idFor('calendar'))).toBe(iconChunkName(idFor('calendar')));
  });

  it('normalises Windows separators to the same bucket', () => {
    const win = '\\repo\\node_modules\\lucide-react\\dist\\esm\\icons\\file-text.mjs';
    expect(iconChunkName(win)).toBe(iconChunkName(idFor('file-text')));
  });

  it('spreads the real icon set evenly across the buckets', () => {
    const counts = new Map();
    for (const name of availableIconNames()) {
      const chunk = iconChunkName(idFor(name));
      counts.set(chunk, (counts.get(chunk) || 0) + 1);
    }
    expect(counts.size).toBe(ICON_CHUNKS);
    // The point of hashing over first-letter grouping: no bucket dominates.
    // Alphabetical buckets peak at ~4x the mean; this stays well under 2x.
    const sizes = [...counts.values()];
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    expect(Math.max(...sizes)).toBeLessThan(mean * 2);
  });
});
