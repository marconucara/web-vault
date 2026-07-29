#!/usr/bin/env node
// web-vault CLI. Runs from the CONSUMER project (the `.web`): all paths resolve
// from process.cwd() (see scripts/paths.mjs), while the app + Vite config live
// in this package. Vite is driven via its JS API with an in-memory config
// (configFile:false) whose `root` is the package, so nothing needs a vite.config
// on the consumer side.
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(PKG_DIR, 'scripts');

function runNode(script) {
  return new Promise((res, rej) => {
    // Propagate the parent's node flags (e.g. --preserve-symlinks used for local
    // portal linking) to child scripts. Empty and a no-op for real installs.
    const child = spawn(process.execPath, [...process.execArgv, join(SCRIPTS, script)], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited with ${code}`))));
    child.on('error', rej);
  });
}

async function runVite(mode) {
  // Imported lazily so `wv genkey`/`wv gen` don't pay Vite's startup cost.
  const { createServer, build, preview } = await import('vite');
  const { createViteConfig } = await import('../lib/vite-config.mjs');
  const config = { configFile: false, ...createViteConfig() };
  if (mode === 'dev') {
    const server = await createServer(config);
    await server.listen();
    server.printUrls();
  } else if (mode === 'build') {
    await build(config);
  } else if (mode === 'preview') {
    const server = await preview(config);
    server.printUrls();
  }
}

const HELP = `web-vault (wv)

Usage: wv <command>

  dev       Generate content, then start the Vite dev server
  build     Full static build into ./dist (content, app, shared pages,
            attachments, maps cache, 404, Functions)
  preview   Serve the built ./dist locally
  gen       Regenerate .wv/content.json only
  genkey    Print a new MAP_CACHE_KEY (never writes a file)
  help      Show this help
`;

async function main() {
  const cmd = process.argv[2] || 'help';
  switch (cmd) {
    case 'dev':
      await runNode('build-content.mjs');
      await runNode('build-maps-cache.mjs');
      await runVite('dev');
      break;
    case 'build':
      await runNode('build-content.mjs');
      await runVite('build');
      await runNode('copy-attachments.mjs');
      await runNode('build-shared.mjs');
      await runNode('build-maps-cache.mjs');
      await runNode('build-404.mjs');
      await runNode('generate-functions.mjs');
      break;
    case 'preview':
      await runVite('preview');
      break;
    case 'gen':
      await runNode('build-content.mjs');
      break;
    case 'genkey':
      await runNode('maps-genkey.mjs');
      break;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      break;
    default:
      process.stderr.write(`wv: unknown command "${cmd}"\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
