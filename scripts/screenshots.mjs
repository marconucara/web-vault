// Regenerates the README's hero image by driving a real browser against a
// running vault. The vault is NOT resolved here: `wv` treats `process.cwd()/..`
// as a vault, so anything in this repo that located one would build the parent
// directory by accident. This attaches to a URL the operator already started.
//
// Manual tool. Deliberately outside `yarn verify` — the gate has to stay
// runnable from a bare clone, with no server and no browser binary.
//
// see plan/todo/0007-generate-readme-screenshots.md

import { chromium } from 'playwright';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// An iPad Air in CSS pixels — its 2360x1640 panel is this at DPR 2. Passing the
// device pixels straight to the browser would instead give a huge window with a
// desktop layout, which is why the scale lives in DPR and not in the viewport.
//
// Defaults, not requirements. Lowering DPR shrinks the file without touching
// the layout, so the frames stay the ones that were reviewed; lowering the
// viewport changes what the app renders and needs a fresh look.
const VIEWPORT = { width: 1180, height: 820 };
const DPR = 1.5;
const FRAME_DELAY_MS = 2000;
const OUTPUT = 'screenshot.webp';

// Lossy beats a palette badly here: the frames carry map tiles and Google Places
// photos, which quantise poorly. At q75 the whole animation costs less than a
// quarter of the equivalent 24-bit APNG, at the same resolution.
const QUALITY = 75;

// The mobile frame shares the canvas with the desktop ones, so its height must
// match theirs exactly or the encoder would have to pad or scale it. 820 CSS px
// is the desktop height, and both are captured at the same DPR — so the two
// line up at 1230 device px with no resampling. Width is free; 400 is a phone.
const MOBILE_VIEWPORT = { width: 400, height: VIEWPORT.height };

async function shot(page, dir, n) {
  const file = path.join(dir, `frame-${n}.png`);
  await page.screenshot({ path: file });
  return file;
}

// Centres a narrower shot on a full-width black canvas, so every frame handed
// to the encoder has identical dimensions. Done in the page itself — the
// browser is already running and can composite, which avoids pulling in an
// image library just to letterbox one frame.
async function padToCanvas(page, file, dir) {
  const out = path.join(dir, 'frame-5-padded.png');
  const b64 = (await readFile(file)).toString('base64');
  const padded = await page.evaluate(
    async ({ src, w, h }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, Math.round((w - img.width) / 2), 0);
      return c.toDataURL('image/png');
    },
    {
      src: `data:image/png;base64,${b64}`,
      w: Math.round(VIEWPORT.width * DPR),
      h: Math.round(VIEWPORT.height * DPR),
    }
  );
  await writeFile(out, Buffer.from(padded.split(',')[1], 'base64'));
  return out;
}

// img2webp ships with libwebp and is not on npm. Checked up front rather than
// after five minutes of browser work, so a missing binary fails in a second.
function requireImg2webp() {
  try {
    execFileSync('img2webp', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'img2webp not found. It ships with libwebp:\n' +
        '  macOS:  brew install webp\n' +
        '  Debian: apt install webp'
    );
  }
}

// Assembles the frames into one animated WebP.
//
// The PNGs are handed over uncompressed-by-us on purpose: passing pre-encoded
// .webp files instead makes img2webp re-encode them losslessly, which lands at
// roughly five times the size.
function writeAnimation(frames, out) {
  execFileSync('img2webp', [
    '-loop', '0',
    '-lossy',
    '-q', String(QUALITY),
    '-m', '6',
    '-d', String(FRAME_DELAY_MS),
    ...frames,
    '-o', out,
  ]);
}

// Scrolls the note until at least two map cards are fully inside the viewport.
// Deliberately a search over the rendered DOM rather than a fixed scroll
// distance: the note's length is not the tool's business, and a magic number
// would silently drift the moment the content changes.
//
// Map cards render as links to the mapped place, which is what makes them
// addressable by role instead of by class name.
const PINS_WANTED = 2;

async function countPinsInView(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('article a[href]')].filter((el) => {
      const href = el.getAttribute('href') || '';
      return /maps|geo:|openstreetmap/i.test(href);
    });
    return cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    }).length;
  });
}

async function scrollToPins(page, note) {
  await note.first().hover();
  const total = await page.evaluate(
    () =>
      [...document.querySelectorAll('article a[href]')].filter((el) =>
        /maps|geo:|openstreetmap/i.test(el.getAttribute('href') || '')
      ).length
  );
  if (total < PINS_WANTED) {
    throw new Error(
      `Found ${total} map card(s) in the note, need ${PINS_WANTED} — this needs a vault with the template's structure (a Trip note with a map).`
    );
  }
  for (let step = 0; step < 60; step++) {
    if ((await countPinsInView(page)) >= PINS_WANTED) return;
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(120);
  }
  throw new Error(`Could not bring ${PINS_WANTED} map cards into view after scrolling the whole note.`);
}

function parseArgs(argv) {
  const args = { url: null, out: 'docs' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

const USAGE = `
Usage: yarn screenshots --url <url> [--out <dir>]

  --url   a vault already running (e.g. http://localhost:5173)
  --out   where to write (default: docs/, what the README points at)
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.url) {
    console.error('Missing --url.\n' + USAGE);
    process.exitCode = 1;
    return;
  }

  requireImg2webp();

  const outDir = path.resolve(args.out);
  // Frames are an intermediate product: they land in a scratch directory and
  // only the assembled animation survives.
  const frameDir = path.join(outDir, '.frames');
  await mkdir(frameDir, { recursive: true });
  const frames = [];

  const browser = await chromium.launch();
  // The app reads prefers-color-scheme directly and has no theme override, so
  // the colour scheme is driven at the browser level rather than in the page.
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  try {
    await page.goto(args.url, { waitUntil: 'networkidle' });

    // Anchored to what the user sees, not to internal class names: the sidebar
    // is present once the app has actually rendered.
    // Scoped to landmarks so names stay unambiguous: `Share` is a substring of
    // the sidebar's `Shared`, and both would match a bare page-level lookup.
    const sidebar = page.getByRole('navigation');

    // Sidebar entries carry their note count in the accessible name ("Trip1"),
    // so these are anchored at the start rather than matched exactly.
    await sidebar.getByRole('button', { name: /^All notes/ }).waitFor({ timeout: 15000 });

    // Frame 1 — a Trip note, share panel open.
    //
    // Anchored to the *type* rather than a note title: a template may rename
    // "Rome in 5 days" without anyone considering that a structural change,
    // but renaming the Trip type is visible and deliberate.
    const trip = sidebar.getByRole('button', { name: /^Trip\b/ });
    if ((await trip.count()) === 0) {
      throw new Error('No "Trip" type in the sidebar — this needs a vault with the template\'s structure.');
    }
    await trip.click();

    const notes = page.getByRole('listitem');
    await notes.first().waitFor({ timeout: 15000 });
    await notes.first().click();

    // Opening the sheet is pure UI: the badge only toggles it. Publishing sits
    // behind a separate button inside the panel, which is never pressed —
    // regenerating screenshots must not commit or publish anything.
    // Scoped to the open note: `Share` is a substring of the sidebar's `Shared`,
    // which a page-level lookup would also match.
    const note = page.locator('article');

    // The editor is lazy (Suspense), so the body is a skeleton for a moment
    // after the note opens. Wait for real rendered prose, or the frame catches
    // grey placeholder bars instead of the note.
    await note.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 20000 });

    await note.getByRole('button', { name: 'Share', exact: true }).first().click();
    // The panel's own copy — waiting on it confirms the sheet is open and in
    // its idle state, before anything has been published.
    await page.getByText('Create a public read-only link').waitFor({ timeout: 5000 });

    frames.push(await shot(page, frameDir, 1));

    // Frame 2 — the note's inline maps, at least two pins in view.
    //
    // Located in the DOM rather than scrolled by a fixed distance: the note can
    // grow or shrink without invalidating this. Leaflet gives its markers
    // role="button", so they are addressable without reaching for class names.
    await page.keyboard.press('Escape');
    await scrollToPins(page, note);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    frames.push(await shot(page, frameDir, 2));

    // Frame 3 — map view, with the marker panel open.
    await page.getByRole('button', { name: 'Map view' }).click();
    await page.getByRole('button', { name: 'Headings' }).click();
    await page.getByRole('button', { name: 'All markers' }).waitFor({ timeout: 15000 });
    // Leaflet pans and zooms to fit after the panel opens; let it settle.
    await page.waitForTimeout(1200);
    frames.push(await shot(page, frameDir, 3));

    // Frame 4 — light theme, map view closed, back at the top of the note.
    await page.getByRole('button', { name: 'Map view' }).click();
    // The app reads prefers-color-scheme directly and exposes no theme
    // override, so the switch happens at the browser level.
    await page.emulateMedia({ colorScheme: 'light' });
    await note.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 20000 });
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.mouse.wheel(0, -100000);
    // Park the cursor outside the editor: hovering a block reveals its insert
    // and drag handles, which would otherwise sit in the frame.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    frames.push(await shot(page, frameDir, 4));

    // Frame 5 — the phone layout, nav drawer open.
    //
    // Below 900px the app switches to one panel at a time, and the hamburger
    // only exists while no note is open — so the note is cleared first. Back to
    // dark, since frame 4's light theme was the odd one out.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize(MOBILE_VIEWPORT);
    // A full reload rather than clearing the hash: the type selection lives in
    // component state, so only a reload puts the app back to its landing view.
    await page.goto(args.url, { waitUntil: 'networkidle' });
    const hamburger = page.getByRole('button', { name: '☰' });
    await hamburger.waitFor({ timeout: 15000 });
    await hamburger.click();
    await page.getByRole('navigation').waitFor({ timeout: 5000 });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    const mobile = await shot(page, frameDir, 5);
    // Every frame must fill the same canvas, so the phone shot is centred on a
    // black field at the desktop width. Heights already match by construction,
    // so nothing is scaled and the phone pixels stay 1:1.
    frames.push(await padToCanvas(page, mobile, frameDir));
  } finally {
    await browser.close();
  }

  const out = path.join(outDir, OUTPUT);
  writeAnimation(frames, out);
  await rm(frameDir, { recursive: true, force: true });

  const { size } = await stat(out);
  console.log(
    `wrote ${path.relative(process.cwd(), out)} — ${frames.length} frames, ` +
      `${FRAME_DELAY_MS / 1000}s each, q${QUALITY}, ${Math.round(size / 1024)} KB`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
