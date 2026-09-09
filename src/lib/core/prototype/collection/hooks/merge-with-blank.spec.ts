import { describe, expect, it } from 'vitest';
import { create } from '$lib/core/prototype/collection/definition.js';
import { group } from '$lib/fields/group/index.js';
import { text } from '$lib/fields/text/index.js';
import { mergeWithBlankDocument } from './merge-with-blank.server.js';

/**
 * The blank merge, and the one value it must not touch.
 *
 * `file` is the upload payload — a `File`, or the JSON stand-in `castBase64ToFile` has not
 * converted yet, since that hook runs five places later. `deepmerge` clones every plain object it
 * walks, so a `File` used to come out of here as a plain object with none of its methods. The hook
 * lifted `file` out and put it back to avoid that, behind an `isUploadConfig` test — this
 * prototype naming a feature to protect one key.
 *
 * It merges only the keys the blank has now, which is the same statement without the name. The
 * assertion is **identity**: `toEqual` would pass on a clone, and a clone is the bug.
 */
const run = async (config: any, data: object) =>
  (await mergeWithBlankDocument({ config, data, event: {} } as any)).data as Record<string, any>;

describe('mergeWithBlankDocument', () => {
  const uploads = create('spec_merge_medias', { upload: true, fields: [text('alt')] });

  it('hands a file through untouched, as the same object', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    const data = await run(uploads, { alt: 'a', file });

    expect(data.file).toBe(file);
    expect(data.file).toBeInstanceOf(File);
  });

  it('does the same for a payload that is not a File yet', async () => {
    // `castBase64ToFile` is hook 6 of beforeCreate; this is hook 1, so the payload can still be
    // the JSON shape. An `instanceof File` guard here would have been wrong for exactly this.
    const payload = { base64: 'zzz', filename: 'a.png' };

    const data = await run(uploads, { file: payload });

    expect(data.file).toBe(payload);
  });

  it('still deep-merges the keys the blank has', async () => {
    const nested = create('spec_merge_pages', {
      fields: [text('title').isTitle(), group('attributes').fields(text('a'), text('b'))]
    });

    const data = await run(nested, { attributes: { a: 'set' } });

    // `b` comes from the blank, `a` from the submission — which is what a merge is for, and what
    // carrying the key across instead would have lost.
    expect(data.attributes).toEqual({ a: 'set', b: null });
  });

  it('leaves a config with no upload alone', async () => {
    const plain = create('spec_merge_plain', { fields: [text('title').isTitle()] });

    const data = await run(plain, { title: 'a' });

    expect(data.title).toBe('a');
  });
});
