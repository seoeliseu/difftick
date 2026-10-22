import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const root = import.meta.dirname;

/** Emits dist/manifest.json from src/manifest.json, stamping the package.json version. */
function manifestPlugin(): Plugin {
  return {
    name: 'difftick-manifest',
    generateBundle() {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
        version: string;
      };
      const manifest = JSON.parse(
        readFileSync(resolve(root, 'src/manifest.json'), 'utf8'),
      ) as Record<string, unknown>;
      manifest.version = pkg.version;
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [manifestPlugin()],
  oxc: {
    jsx: { importSource: 'preact' },
  },
  define: {
    // Library mode does not replace this; the content script runs where `process` is undefined.
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: resolve(root, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'DiffTick',
      fileName: () => 'content.js',
    },
  },
  test: {
    environment: 'jsdom',
    // The content script only acts on github.com PR routes, so tests start on one.
    environmentOptions: { jsdom: { url: 'https://github.com/octo/repo/pull/1/files' } },
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
