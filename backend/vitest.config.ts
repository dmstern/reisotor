import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Explizit statt nur Default: backend/test/helpers/buildTestApp.ts verlässt sich darauf, dass
    // jede Testdatei ein frisches Modul-Registry bekommt (frische :memory:-DB pro Datei statt pro
    // Test, siehe dort).
    isolate: true,
  },
});
