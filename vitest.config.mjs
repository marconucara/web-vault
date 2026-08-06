import { defineConfig } from 'vitest/config';

// Stubs for the virtual modules the build generates from the consumer's vault
// (see lib/vite-config.mjs). Tests run from a bare clone with no vault, so both
// stand in as empty: no notes, and no build-time bundled icons.
const VIRTUAL_STUBS = {
  'virtual:web-vault-content':
    'export default { notes: [], views: [], types: [], typeMeta: {}, titleIndex: {}, idTitle: {}, notesById: {}, build: {} };',
  'virtual:web-vault-icons': 'export default {};',
};

const virtualContentTestPlugin = {
  name: 'web-vault-virtual-test-stubs',
  resolveId(source) {
    return source in VIRTUAL_STUBS ? `\0${source}-test` : undefined;
  },
  load(id) {
    for (const [source, code] of Object.entries(VIRTUAL_STUBS)) {
      if (id === `\0${source}-test`) return code;
    }
    return undefined;
  },
};

export default defineConfig({
  plugins: [virtualContentTestPlugin],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
    pool: 'forks',
    fileParallelism: true,
    isolate: true,
  },
});
