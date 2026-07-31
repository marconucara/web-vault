import { defineConfig } from 'vitest/config';

const virtualContentTestPlugin = {
  name: 'web-vault-content-test-stub',
  resolveId(source) {
    return source === 'virtual:web-vault-content' ? '\0virtual:web-vault-content-test' : undefined;
  },
  load(id) {
    return id === '\0virtual:web-vault-content-test'
      ? 'export default { notes: [], views: [], types: [], typeMeta: {}, titleIndex: {}, idTitle: {}, notesById: {}, build: {} };'
      : undefined;
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
