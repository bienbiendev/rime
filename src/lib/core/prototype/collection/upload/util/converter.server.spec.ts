import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mediaFilePath } from '../disk/medias.server.js';
import { fileForDocument } from './converter.server.js';

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fileForDocument', () => {
  const medias = { kebab: 'medias' };
  const invoices = { kebab: 'invoices' };

  test('reads the file a document names in the folder', async () => {
    writeFileSync(mediaFilePath(medias, 'a.txt'), 'a');
    const file = await fileForDocument(medias, { filename: 'a.txt' });
    expect(file?.name).toBe('a.txt');
  });

  test('a collection reads its own folder only', async () => {
    writeFileSync(mediaFilePath(medias, 'a.txt'), 'a');
    expect(await fileForDocument(invoices, { filename: 'a.txt' })).toBeUndefined();
  });

  test('a name that leaves the folder is no file', async () => {
    writeFileSync(join(process.cwd(), '.env'), 'SECRET=1');
    expect(await fileForDocument(medias, { filename: '../../.env' })).toBeUndefined();
  });
});
