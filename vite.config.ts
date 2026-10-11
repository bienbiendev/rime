import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { rime } from './src/lib/core/dev/vite.server.js';

function extractHostFromURL(url?: string) {
  if (!url) return 'localhost';
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    console.error('Invalid URL:', error);
    return 'localhost';
  }
}

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true
      },
      adapter: adapter(),
      alias: {
        'rimecms/panel/*': './src/lib/panel/*',
        'rimecms/panel': './src/lib/panel/index.js',
        'rimecms/server': './src/lib/server.js',
        'rimecms/config/server': './src/lib/core/config/index.server.js',
        'rimecms/config': './src/lib/core/config/index.js',
        rimecms: './src/lib',
        // Same as package.json's #lib/*, as a tsconfig path: Playwright's loader reads paths, not
        // imports. `#lib/*` and not `#lib`: svelte-package would take `#lib` as package.json's
        // own `#lib` (src/lib/index.js) and resolve `#lib/x` to `index.js/x`.
        '#lib/*': './src/lib/*'
      }
    }),
    rime()
  ],
  // The dev server listens on SITE_URL's host
  server: { host: extractHostFromURL(loadEnv('development', process.cwd(), '').SITE_URL) },
  optimizeDeps: {
    exclude: ['sharp'],
    include: ['@lucide/svelte']
  },
  ssr: { external: ['sharp'] },
  build: { rollupOptions: { external: ['sharp'] } },
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.spec.{js,ts}'],
          exclude: ['src/**/*.svelte.spec.{js,ts}'],
          typecheck: { enabled: true, include: ['src/**/*.spec-d.ts', 'src/**/*.test-d.ts'] }
        }
      }
    ]
  }
});
