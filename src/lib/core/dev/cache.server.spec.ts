import { expect, it, vi } from 'vitest';
import cache from './cache.server.js';

// The cache folder, in a temporary directory: the real one is the project's node_modules/.rime
vi.mock('../constants.server.js', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return { RIME_DEV_CACHE_DIR: join(mkdtempSync(join(tmpdir(), 'rime-cache-')), '.rime') };
});

it('clears twice in a row', () => {
  cache.remember('config', 'a');
  cache.clear();
  expect(() => cache.clear()).not.toThrow();
  expect(cache.matches('config', 'a')).toBe(false);
});
