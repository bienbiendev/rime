import { text } from '#lib/fields/text/index.js';
import type { Dic } from '#lib/util/types.js';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mediaFilePath } from '../disk/medias.server.js';
import { processFileUpload } from './process-file-upload.server.js';

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const config = { slug: 'medias', kebab: 'medias', upload: {}, fields: [text('filename')] };
const originalDoc = { id: 'd1', filename: 'old.txt', mimeType: 'text/plain', filesize: '3' };

/** An update of `originalDoc` with `data`, in a rime where no other row names a file. */
const update = (data: Dic) => {
  const rime = {
    config: { collections: { medias: config }, getLocalesCodes: () => [] },
    collection: () => ({
      system: () => ({ findById: async () => originalDoc, find: async () => [] })
    })
  };
  return processFileUpload({
    config,
    event: { locals: { rime } },
    operation: 'update',
    data,
    context: { params: { id: 'd1' }, originalDoc }
  } as any) as Promise<Dic>;
};

describe('processFileUpload', () => {
  test('a new file leaves the replaced one on disk until the update is written', async () => {
    writeFileSync(mediaFilePath(config, 'old.txt'), 'old');

    const result = await update({ file: new File(['new'], 'new.txt', { type: 'text/plain' }) });

    expect(result.data.filename).toBe('new.txt');
    expect(existsSync(mediaFilePath(config, 'new.txt'))).toBe(true);
    expect(existsSync(mediaFilePath(config, 'old.txt'))).toBe(true);
    expect(result.context.replacedFiles).toEqual([{ filename: 'old.txt', files: ['old.txt'] }]);
  });

  test('`file: null` takes the file off the row', async () => {
    writeFileSync(mediaFilePath(config, 'old.txt'), 'old');

    const result = await update({ file: null });

    expect(result.data).toMatchObject({ filename: null, mimeType: null, filesize: null });
    expect(existsSync(mediaFilePath(config, 'old.txt'))).toBe(true);
    expect(result.context.replacedFiles).toEqual([{ filename: 'old.txt', files: ['old.txt'] }]);
  });

  test('an update that sends no file replaces none', async () => {
    const result = await update({ alt: 'x' });
    expect(result.context.replacedFiles).toEqual([]);
  });
});
