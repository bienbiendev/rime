import { describe, expect, test, vi } from 'vitest';
import { denyStorage, isStorageUrl } from './deny-storage.server.js';

describe('isStorageUrl', () => {
  test('names /storage and anything under it, however it is spelled', () => {
    for (const url of [
      '/storage',
      '/storage/',
      '/storage/probe.txt',
      '/storage/uploads/medias/a.jpg?v=1',
      '/%73torage/probe.txt',
      '/Storage/probe.txt',
      '/uploads/../storage/probe.txt'
    ]) {
      expect(isStorageUrl(url), url).toBe(true);
    }
  });

  test('leaves every other path', () => {
    for (const url of ['/', '/storages', '/uploads/medias/a.jpg', '/panel/storage', '/%E0%A4%A']) {
      expect(isStorageUrl(url), url).toBe(false);
    }
  });
});

describe('denyStorage', () => {
  const run = (url: string) => {
    const res = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    denyStorage({ url } as any, res as any, next);
    return { res, next };
  };

  test('answers 404 for storage, and passes the rest on', () => {
    const denied = run('/storage/probe.txt');
    expect(denied.res.statusCode).toBe(404);
    expect(denied.res.end).toHaveBeenCalled();
    expect(denied.next).not.toHaveBeenCalled();

    const passed = run('/uploads/medias/a.jpg');
    expect(passed.next).toHaveBeenCalled();
    expect(passed.res.end).not.toHaveBeenCalled();
  });
});
