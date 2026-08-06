// Reads the vault (../) at build time and produces src/generated/content.json:
// notes (frontmatter + body + H1 title + timestamps), views/*.yml views, and a
// title->id index to resolve wikilinks. Only standard library + gray-matter + js-yaml.
import './load-env.mjs'; // first: populate process.env from .env before other modules read it
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, extname, basename, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { resolveMapsForBodies } from './resolve-maps.mjs';
import { VAULT_DIR as VAULT, GEN_DIR as OUT, CONTENT_JSON, VIEWS_DIR, PACKAGE_DIR } from './paths.mjs';

// Dotted names (.web, .tools, .git, ...) are already skipped by walk() via
// startsWith('.'). The rules live in content-ignore.mjs so the dev watcher can
// share them without importing this script (which generates on import).
import { IGNORE_DIRS, IGNORE_FILES } from './content-ignore.mjs';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(name)) walk(full, acc);
    } else if (extname(name) === '.md' && !IGNORE_FILES.has(name)) {
      acc.push(full);
    }
  }
  return acc;
}

// Reliable dates for sorting: derived from git instead of mtime, which on the
// Cloudflare Pages clone ≈ build time (all equal → broken sorting).
// A single `git log`: the first time a file appears (from the most recent) is
// the last-modified date; the last time (the oldest) is the creation date.
// @@@ marker to avoid confusing commit lines with paths. Fallback: if git is
// not available or the file has no history, the filesystem mtime/ctime is used.
function gitDateMaps(vault) {
  const modified = {};
  const created = {};
  const lastCommit = {}; // path -> { sha, subject } of the last commit that touched it
  try {
    // Shallow clone (possible on Pages): without history the dates are unreliable.
    // Best-effort: try to complete the history.
    try {
      const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: vault,
        encoding: 'utf8',
      }).trim();
      if (shallow === 'true') {
        try {
          execFileSync('git', ['fetch', '--unshallow', '--quiet'], { cwd: vault, stdio: 'ignore' });
        } catch {
          console.warn('[gen] shallow repo and unshallow failed: partial git dates.');
        }
      }
    } catch {
      // not a git repo or git missing: fall through to the fallback below
    }
    // %ct|%h|%s per commit: timestamp, short sha, subject (for dates + history).
    const out = execFileSync('git', ['log', '--no-renames', '--format=@@@%ct|%h|%s', '--name-only'], {
      cwd: vault,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
    let ct = null;
    let commit = null;
    for (const line of out.split('\n')) {
      if (line.startsWith('@@@')) {
        const [ts, sha, ...rest] = line.slice(3).split('|');
        const n = Number(ts);
        ct = Number.isFinite(n) ? n : null;
        commit = sha ? { sha, subject: rest.join('|') } : null;
        continue;
      }
      if (!line || ct == null) continue;
      if (!(line in modified)) modified[line] = ct; // first encounter = most recent
      if (!(line in lastCommit) && commit) lastCommit[line] = commit; // same: most recent
      created[line] = ct; // overwritten down to the oldest commit
    }
  } catch (e) {
    console.warn('[gen] git dates unavailable, falling back to mtime:', e.message);
  }
  return { modified, created, lastCommit };
}

function makeSnippet(body) {
  const lines = body.split('\n');
  const kept = [];
  let droppedH1 = false;
  for (const ln of lines) {
    if (!droppedH1 && /^#\s+/.test(ln)) { droppedH1 = true; continue; }
    kept.push(ln);
  }
  return kept
    .join(' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

const notes = [];
const titleIndex = {};
const idTitle = {};

const { modified: gitModified, created: gitCreated, lastCommit: gitLastCommit } = gitDateMaps(VAULT);

for (const file of walk(VAULT)) {
  const rel = relative(VAULT, file).split(sep).join('/');
  const id = rel.replace(/\.md$/, '');
  const raw = readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  const h1 = (content.match(/^#\s+(.+)$/m) || [])[1];
  const title = (h1 || basename(id)).trim();
  const st = statSync(file);
  // words: raw count over the body (whitespace). bytes: actual file size.
  const words = (content.trim().match(/\S+/g) || []).length;
  notes.push({
    id,
    path: rel,
    title,
    type: data.type || null,
    frontmatter: data,
    body: content,
    snippet: makeSnippet(content),
    words,
    bytes: Buffer.byteLength(raw, 'utf8'),
    lastCommit: gitLastCommit[rel] || null,
    // Dates from git (seconds → ms); fallback to filesystem mtime/ctime.
    mtime: gitModified[rel] != null ? gitModified[rel] * 1000 : st.mtimeMs,
    ctime: gitCreated[rel] != null ? gitCreated[rel] * 1000 : st.ctimeMs,
  });
  titleIndex[id.toLowerCase()] = id;
  titleIndex[title.toLowerCase()] = id;
  titleIndex[basename(id).toLowerCase()] = id;
  idTitle[id] = title;
}

const views = [];
const viewsDir = VIEWS_DIR;
if (existsSync(viewsDir)) {
  for (const name of readdirSync(viewsDir)) {
    if (extname(name) !== '.yml') continue;
    try {
      const def = yaml.load(readFileSync(join(viewsDir, name), 'utf8')) || {};
      views.push({ id: name.replace(/\.yml$/, ''), ...def });
    } catch (e) {
      console.warn(`[gen] invalid view: ${name} (${e.message})`);
    }
  }
}

// The framework's own version, from THIS package's package.json — resolved via
// PACKAGE_DIR, not the vault or the consumer project. Everything else in the
// build object describes the adopter's vault; this one describes web-vault
// itself, and the two are easy to confuse because in this repo's own checkout
// the directories coincide. Reading it from PROJECT_DIR would silently pick up
// the adopter's shell package.json — a different, wrong number, and one that
// only misbehaves once installed. See adr/0037-*.md.
function frameworkVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
    return pkg.version || '';
  } catch (e) {
    console.warn('[gen] framework package.json unreadable:', e.message);
    return '';
  }
}

// Build info for the toolbar: commit SHA + timestamp. On Cloudflare Pages the
// SHA comes from CF_PAGES_COMMIT_SHA; in local dev from `git rev-parse HEAD`.
// Locally with changes in progress the SHA stays the last commit's (marked
// `dirty`): showing the previous commit is acceptable.
function gitBuildInfo(vault) {
  const git = (args) => execFileSync('git', args, { cwd: vault, encoding: 'utf8' }).trim();
  let sha = process.env.CF_PAGES_COMMIT_SHA || '';
  let dirty = false;
  try {
    if (!sha) sha = git(['rev-parse', 'HEAD']);
    // dirty only locally: on the clean Pages clone it is always false.
    if (!process.env.CF_PAGES_COMMIT_SHA) {
      dirty = git(['status', '--porcelain']).length > 0;
    }
  } catch (e) {
    console.warn('[gen] git unavailable for build info:', e.message);
  }
  // owner/name of the repo, for the toolbar commit link. Generic: from the git
  // remote, overridable via env. No hardcoded vault identity.
  let repo = process.env.WEB_VAULT_REPO || process.env.GITHUB_REPO || '';
  if (!repo) {
    try {
      const url = git(['remote', 'get-url', 'origin']);
      const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
      if (m) repo = m[1];
    } catch {
      /* no remote: leave empty */
    }
  }
  return {
    sha,
    short: sha ? sha.slice(0, 7) : '',
    dirty,
    builtAt: new Date().toISOString(),
    repo,
    frameworkVersion: frameworkVersion(),
  };
}
const build = gitBuildInfo(VAULT);

// Resolve Google Maps links (short links -> title + coords) at build time, so
// the client can render map cards with no API key and no runtime request.
const maps = await resolveMapsForBodies(notes.map((n) => n.body));

mkdirSync(OUT, { recursive: true });
writeFileSync(CONTENT_JSON, JSON.stringify({ notes, views, titleIndex, idTitle, build, maps }));
console.log(`[gen] ${notes.length} notes, ${views.length} views -> .wv/content.json (build ${build.short || 'n/a'}${build.dirty ? '+' : ''})`);

// NOTE: Cloudflare Pages Functions (including the _buildinfo branch bake that
// used to live here) are now generated by scripts/generate-functions.mjs, run
// by `wv build`. This script only produces content.json.
