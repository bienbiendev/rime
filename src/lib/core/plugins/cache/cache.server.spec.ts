import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Cache as CacheClass } from './cache.server.js';

const env = vi.hoisted(() => ({ strategy: 'memory' }));

vi.mock('$app/env/private', () => ({
  RIME_CACHE_ENABLED: true,
  get RIME_CACHE_STRATEGY() {
    return env.strategy;
  }
}));
vi.mock('$app/server', () => ({ getRequestEvent: () => ({ locals: { cacheEnabled: true } }) }));

/** The disk strategy writes under `<cwd>/.cache`: here, a folder of its own. */
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rime-cache-'));
let Cache: typeof CacheClass;

beforeAll(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  ({ Cache } = await import('./cache.server.js'));
});

afterAll(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('Cache.get', () => {
  it('a disk hit answers dates as dates', async () => {
    env.strategy = 'disk';
    await Cache.get('k', async () => ({ at: new Date(0) }));
    const hit = await Cache.get('k', async () => ({ at: new Date(1) }));

    expect(hit.at).toBeInstanceOf(Date);
    expect(hit.at.getTime()).toBe(0);
  });

  it('a memory hit is a copy', async () => {
    env.strategy = 'memory';
    const first = await Cache.get('m', async () => ({ title: 'Home' }));
    first.title = 'HOME';
    const hit = await Cache.get('m', async () => ({ title: 'x' }));
    hit.title = 'HOME';

    expect((await Cache.get('m', async () => ({ title: 'x' }))).title).toBe('Home');
  });

  it('keeps a key that names another folder inside .cache', async () => {
    env.strategy = 'disk';
    await Cache.get('../escaped', async () => ({ title: 'Home' }));

    expect(fs.existsSync(path.join(cwd, 'escaped.bin'))).toBe(false);
    expect(await Cache.get('../escaped', async () => ({ title: 'x' }))).toEqual({ title: 'Home' });
  });
});
