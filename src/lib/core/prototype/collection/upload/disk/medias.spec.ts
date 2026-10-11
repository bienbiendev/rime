import { isStaff } from '#lib/core/auth/access.js';
import type { User } from '#lib/core/auth/types.js';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  filesOwner,
  isPrivateUpload,
  mediaFilePath,
  mediasDirectory,
  mediasFolder
} from './medias.server.js';

describe('isPrivateUpload', () => {
  test('a collection anonymous callers may not read is private', () => {
    expect(isPrivateUpload({ access: { read: isStaff } })).toBe(true);
    expect(isPrivateUpload({ access: { read: () => true } })).toBe(false);
  });

  test('a rule that needs the document id is read with none, and is private', () => {
    const own = { access: { read: (_: unknown, { id }: { id?: string }) => id === 'public' } };
    expect(isPrivateUpload(own)).toBe(true);
  });

  test('a rule that throws for no user is private', () => {
    const editors = { access: { read: (user?: User) => user!.roles.includes('editor') } };
    expect(isPrivateUpload(editors)).toBe(true);
  });
});

describe('mediasDirectory', () => {
  test("a collection's folder is its kebab", () => {
    expect(mediasFolder({ kebab: 'private-medias' })).toBe('private-medias');
    expect(mediasDirectory({ kebab: 'private-medias' })).toBe(
      path.resolve(process.cwd(), 'storage/uploads/private-medias')
    );
  });

  test('or the folder it names', () => {
    const invoices = { kebab: 'private-medias', upload: { folder: 'invoices' } };
    expect(mediasFolder(invoices)).toBe('invoices');
    expect(mediasDirectory(invoices)).toBe(path.resolve(process.cwd(), 'storage/uploads/invoices'));
  });
});

test('a versions collection keeps its files in its document folder', () => {
  const medias = { kebab: 'medias' };
  const versions = { kebab: 'medias--versions', _shadowOf: 'medias' };
  const configs = { getCollection: () => medias };
  expect(filesOwner(configs, versions)).toBe(medias);
  expect(filesOwner(configs, medias)).toBe(medias);
});

test('a stored name names a file in the folder', () => {
  const medias = { kebab: 'medias' };
  expect(mediaFilePath(medias, 'photo.jpg')).toBe(
    path.resolve(process.cwd(), 'storage/uploads/medias/photo.jpg')
  );
  expect(() => mediaFilePath(medias, '../../.env')).toThrow();
  expect(() => mediaFilePath(medias, 'a/b.jpg')).toThrow();
  expect(() => mediaFilePath(medias, '..')).toThrow();
  expect(() => mediaFilePath(medias, '.')).toThrow();
});
