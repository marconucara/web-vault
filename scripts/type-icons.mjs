// The set of lucide icons a build must bundle eagerly.
//
// Type icons come from the vault's Type documents (`icon:`/`_icon:` in their
// frontmatter), so which icons the app will render is already known when the
// build reads content.json. Resolving them through lucide's DynamicIcon anyway
// costs a network round trip per icon on first paint, which is why the sidebar
// and note list used to render blank placeholders and fill in late while the
// app's own local glyphs (src/components/Icon.jsx) were there immediately.
//
// This module turns the content into a list of names; vite-config.mjs turns
// that list into a static module of lucide components (see `virtual:web-vault-
// icons`). DynamicIcon stays as the fallback for names that were not known at
// build time — a type whose icon was edited in the running app, before the next
// build regenerates this set.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

// UI icons referenced by name in the app that are lucide names rather than
// entries in the local PATHS set. They are not in content.json, so they have to
// be named here or they would keep taking the dynamic path.
export const UI_LUCIDE_ICONS = ['list'];

/** kebab-case lucide name -> its PascalCase named export ("file-text" -> "FileText"). */
export function exportName(name) {
  return name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
}

/**
 * Icon names used by the Type documents of a parsed content.json, plus the
 * app's own lucide-named UI icons. Sorted and de-duplicated so the generated
 * module is stable across builds (no needless chunk churn).
 */
export function usedIconNames(content) {
  const notes = Array.isArray(content?.notes) ? content.notes : [];
  const fromTypes = notes
    .filter((n) => n?.type === 'Type')
    .map((n) => n?.frontmatter?.icon || n?.frontmatter?._icon)
    .filter((v) => typeof v === 'string' && v.length > 0);
  return [...new Set([...UI_LUCIDE_ICONS, ...fromTypes])].sort();
}

/** Same, reading content.json from disk. Missing/invalid file -> the UI set. */
export function usedIconNamesFromFile(path) {
  try {
    return usedIconNames(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return usedIconNames({});
  }
}

/**
 * The icons lucide ships, read from the installed package's icon directory.
 * `lucide-react/dynamic` exports the same list but is bundler-only resolution,
 * unreachable from a plain Node import; the directory is the same source of
 * truth and is exactly the set a deep import can reach.
 */
export function availableIconNames() {
  const require = createRequire(import.meta.url);
  // Anchor on package.json: `main` resolves into dist/cjs, the wrong subtree.
  const pkgRoot = dirname(require.resolve('lucide-react/package.json'));
  const dir = join(pkgRoot, 'dist', 'esm', 'icons');
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.mjs'))
      .map((f) => f.slice(0, -4))
  );
}

/**
 * The source of the generated module: a name -> component map of every icon
 * above that lucide actually ships. Unknown names (a typo in a Type document)
 * are dropped rather than breaking the build; Icon.jsx falls back for them.
 */
export function renderIconModule(names, validNames = availableIconNames()) {
  const known = names.filter((n) => validNames.has(n));
  const imports = known
    .map((n) => `import ${exportName(n)} from 'lucide-react/dist/esm/icons/${n}.mjs';`)
    .join('\n');
  const entries = known.map((n) => `  ${JSON.stringify(n)}: ${exportName(n)},`).join('\n');
  return `${imports}\nexport default {\n${entries}\n};\n`;
}
