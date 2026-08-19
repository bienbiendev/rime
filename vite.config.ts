import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { rime } from './src/lib/core/dev/vite/index.server.js';

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
  plugins: [sveltekit(), rime()],
  server: { host: extractHostFromURL(process.env.PUBLIC_RIME_URL) },
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
          exclude: ['src/**/*.svelte.spec.{js,ts}']
        }
      }
    ]
  }
});
