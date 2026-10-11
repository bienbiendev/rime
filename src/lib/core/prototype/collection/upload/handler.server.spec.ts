import { isStaff } from '#lib/core/auth/access.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { Dic } from '#lib/util/types.js';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { byteRange, handleUploads } from './handler.server.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-uploads-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  mkdirSync(join(root, 'storage/uploads/private-medias'), { recursive: true });
  writeFileSync(join(root, 'storage/uploads/medias/a.txt'), 'abcdefghij');
  writeFileSync(join(root, 'storage/uploads/private-medias/b.txt'), 'private');
  writeFileSync(join(root, 'storage/uploads/private-medias/b-thumbnail-400.jpg'), 'thumb');
  writeFileSync(join(root, '.env'), 'SECRET=1');
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Read by anyone; read by staff, with a thumbnail size
const medias = { slug: 'medias', kebab: 'medias', upload: {}, access: { read: () => true } };
const privateMedias = {
  slug: 'privateMedias',
  kebab: 'private-medias',
  upload: { imageSizes: [{ name: 'thumbnail', width: 400 }] },
  access: { read: isStaff }
};

// The document of `privateMedias` that names b.txt, as a read answers it
const privateDoc = {
  filename: 'b.txt',
  sizes: { thumbnail: '/uploads/private-medias/b-thumbnail-400.jpg' }
};

type Options = { method?: string; headers?: Dic; user?: Dic; docs?: Dic[]; refuseAtOnce?: boolean };

/**
 * Runs the handle on `pathname`. `docs` are what a read of the private collection finds; anyone
 * but staff is refused, by a rejected read or, with `refuseAtOnce`, by a throw before it starts.
 */
const request = async (pathname: string, options: Options = {}) => {
  const { method = 'GET', headers = {}, user, docs = [privateDoc], refuseAtOnce } = options;
  const resolve = vi.fn(async () => new Response('site'));
  const refuse = () => {
    throw new RimeError(RimeError.UNAUTHORIZED);
  };
  const find = refuseAtOnce ? refuse : async () => (isStaff(user as any) ? docs : refuse());
  const event = {
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`, { method, headers }),
    locals: {
      user,
      rime: {
        config: { raw: { collections: [medias, privateMedias] } },
        collection: () => ({ find })
      }
    }
  };
  const response = await handleUploads({ event, resolve } as any);
  return { response, resolve };
};

const staff = { isStaff: true, roles: ['admin'] };

describe('handleUploads', () => {
  test("answers a public collection's file to anyone", async () => {
    const { response } = await request('/uploads/medias/a.txt');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('abcdefghij');
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
  });

  test("answers a private collection's file and its sizes to a reader", async () => {
    const file = await request('/uploads/private-medias/b.txt', { user: staff });
    expect(file.response.status).toBe(200);
    expect(await file.response.text()).toBe('private');
    expect(file.response.headers.get('cache-control')).toBe('private, no-cache');

    const size = await request('/uploads/private-medias/b-thumbnail-400.jpg', { user: staff });
    expect(size.response.status).toBe(200);
    expect(size.response.headers.get('content-type')).toBe('image/jpeg');
  });

  test('answers 404 for a private file the caller may not read, or no document names', async () => {
    expect((await request('/uploads/private-medias/b.txt')).response.status).toBe(404);
    const atOnce = await request('/uploads/private-medias/b.txt', { refuseAtOnce: true });
    expect(atOnce.response.status).toBe(404);
    const unnamed = await request('/uploads/private-medias/b.txt', { user: staff, docs: [] });
    expect(unnamed.response.status).toBe(404);
  });

  test('answers 404 for a name that is not a file of the folder', async () => {
    for (const name of ['..%2F..%2F..%2F.env', 'missing.txt', '%E0%A4%A']) {
      expect((await request(`/uploads/medias/${name}`)).response.status).toBe(404);
    }
  });

  test('leaves a folder no collection has, and a write, to the rest of the chain', async () => {
    const other = await request('/uploads/press/a.txt');
    expect(other.resolve).toHaveBeenCalled();
    expect(await other.response.text()).toBe('site');

    const post = await request('/uploads/medias/a.txt', { method: 'POST' });
    expect(post.resolve).toHaveBeenCalled();
  });

  test('answers 304 to a caller holding the file', async () => {
    const { response } = await request('/uploads/medias/a.txt');
    const etag = response.headers.get('etag')!;
    expect(response.headers.get('last-modified')).toBeTruthy();

    const again = await request('/uploads/medias/a.txt', { headers: { 'if-none-match': etag } });
    expect(again.response.status).toBe(304);
    expect(again.response.body).toBeNull();
  });

  test('answers the bytes a range names, and 416 outside the file', async () => {
    const range = { range: 'bytes=2-4' };
    const { response } = await request('/uploads/medias/a.txt', { headers: range });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(response.headers.get('content-length')).toBe('3');
    expect(await response.text()).toBe('cde');

    const outside = await request('/uploads/medias/a.txt', { headers: { range: 'bytes=10-' } });
    expect(outside.response.status).toBe(416);
    expect(outside.response.headers.get('content-range')).toBe('bytes */10');
  });

  test('answers HEAD with the headers and no body', async () => {
    const { response } = await request('/uploads/medias/a.txt', { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.body).toBeNull();
  });
});

describe('byteRange', () => {
  test('reads a start and an end, an open end, and a suffix', () => {
    expect(byteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(byteRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=990-2000', 1000)).toEqual({ start: 990, end: 999 });
  });

  test('is unsatisfiable past the end, and none for a range it does not serve', () => {
    expect(byteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange('bytes=0-1,5-6', 1000)).toBeNull();
    expect(byteRange('bytes=5-1', 1000)).toBeNull();
    expect(byteRange('items=0-1', 1000)).toBeNull();
  });
});
