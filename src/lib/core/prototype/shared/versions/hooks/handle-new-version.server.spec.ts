import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import { VERSIONS_OPERATIONS } from '#lib/core/prototype/shared/versions/strategy.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { block, blocks } from '#lib/fields/blocks/index.js';
import { group } from '#lib/fields/group/index.js';
import { relation } from '#lib/fields/relation/index.js';
import { richText } from '#lib/fields/rich-text/index.js';
import { text } from '#lib/fields/text/index.js';
import { mediaFilePath } from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import type { Dic } from '#lib/util/types.js';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { handleNewVersion } from './handle-new-version.server.js';

vi.mock('#lib/core/prototype/shared/metas/lock.server.js', () => ({
  moveEditLock: async () => {}
}));

/**
 * A new version of `originalDoc` from `data`: what the hook hands on, and the rows it created.
 * `config` adds to the collection's config, `user` makes the request.
 */
const newVersion = async (
  fields: FieldBuilder[],
  originalDoc: Dic,
  data: Dic,
  config: Dic = {},
  user?: Dic
) => {
  const created: Dic[] = [];
  const create = async ({ data }: Dic) => {
    created.push(data);
    return { id: 'v2' };
  };
  const rime = {
    collection: () => ({ system: () => ({ create }) }),
    config: { getLocalesCodes: () => [] }
  };

  const result = await handleNewVersion({
    config: {
      type: 'collection',
      slug: 'news',
      fields,
      versions: {},
      _versions: { slug: 'x' },
      ...config
    },
    event: { locals: { rime, user } },
    data,
    operation: 'update',
    context: {
      versionOperation: VERSIONS_OPERATIONS.NEW_VERSION,
      originalDoc,
      originalConfigMap: buildConfigMap(originalDoc, fields),
      params: {}
    }
  } as any);

  return { result: result as Dic, created };
};

test('a new version keeps the document a rich-text node points at', async () => {
  const fields = [richText('body'), blocks('sections', [block('text').fields(richText('body'))])];
  const body = {
    type: 'doc',
    content: [{ type: 'resource', attrs: { id: 'p1', title: 'About' } }]
  };
  const originalDoc = {
    id: 'doc',
    versionId: 'v1',
    body,
    sections: [{ id: 'b1', type: 'text', body }]
  };

  const { created } = await newVersion(fields, originalDoc, {});

  expect(created).toHaveLength(1);
  expect(created[0].body).toEqual(body);
  expect(created[0].sections).toEqual([{ type: 'text', body }]);
});

test('the new row takes the file, and the rest of the update has none to save', async () => {
  const file = new File(['new'], 'new.txt', { type: 'text/plain' });

  const { result, created } = await newVersion(
    [text('alt')],
    { id: 'doc', versionId: 'v1' },
    {
      file,
      alt: 'x'
    }
  );

  expect(created[0].file).toBe(file);
  expect(result.data).toEqual({ alt: 'x' });
});

describe('who the new row names as its writer', () => {
  test('a staff member', async () => {
    const { created } = await newVersion(
      [text('alt')],
      { id: 'doc', versionId: 'v1' },
      { alt: 'B' },
      {},
      { id: 's1', isStaff: true }
    );
    expect(created[0].updatedBy).toBe('s1');
  });

  test('nobody for a caller who is not staff, such as an api key: the column names staff', async () => {
    const { created } = await newVersion(
      [text('alt')],
      { id: 'doc', versionId: 'v1' },
      { alt: 'B' },
      {},
      { id: 'app1', isStaff: false }
    );
    expect(created[0]).not.toHaveProperty('updatedBy');
  });
});

describe('a field the caller may not write', () => {
  const user = { id: 'u1' };
  const original = { id: 'doc', versionId: 'v1', alt: 'A', secret: 'S', meta: { note: 'N' } };
  const fields = [
    text('alt'),
    text('secret').access({ update: () => false }),
    group('meta')
      .access({ update: () => false })
      .fields(text('note'))
  ];

  test('keeps the value of the previous version in the new row', async () => {
    const { result, created } = await newVersion(
      fields,
      original,
      { alt: 'B', secret: 'leak', meta: { note: 'leak' } },
      {},
      user
    );

    expect(created[0].alt).toBe('B');
    expect(created[0].secret).toBe('S');
    expect(created[0].meta).toEqual({ note: 'N' });
    // The rest of the update gets the submission as sent, for `validateFields` to drop them
    expect(result.data).toEqual({ alt: 'B', secret: 'leak', meta: { note: 'leak' } });
  });
});

test('a denied field inside a stored list row keeps its stored value in the new row', async () => {
  // Cast: `medias` is only a registered slug in the fixture that declares it.
  const image = (relation('image') as any).to('medias').access({ update: () => false });
  const fields = [blocks('layout', [block('hero').fields(text('title'), image)])];
  const original = {
    id: 'doc',
    versionId: 'v1',
    layout: [
      {
        id: 'b1',
        type: 'hero',
        title: 'A',
        image: [{ id: 'r1', relationTo: 'medias', documentId: 'm1' }]
      }
    ]
  };

  const { created } = await newVersion(
    fields,
    original,
    { layout: [{ id: 'b1', type: 'hero', title: 'B' }] },
    {},
    { id: 'u1' }
  );

  expect(created[0].layout[0].title).toBe('B');
  expect(created[0].layout[0].image).toEqual([{ relationTo: 'medias', documentId: 'm1' }]);
});

describe('an upload document', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Its files live in storage/uploads/medias
  const medias = { kebab: 'medias', upload: {} };

  /** A version whose file, `a.txt`, is on disk. */
  const withFileOnDisk = () => {
    const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
    mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    writeFileSync(mediaFilePath(medias, 'a.txt'), 'a');
    return { id: 'doc', versionId: 'v1', filename: 'a.txt', alt: 'A' };
  };

  test('a new version that sends no file keeps the previous one', async () => {
    const original = withFileOnDisk();
    const { created } = await newVersion([text('alt')], original, { alt: 'B' }, medias);
    expect(created[0].file).toBeInstanceOf(File);
    expect(created[0].file.name).toBe('a.txt');
  });

  test('a new version from `file: null` has no file', async () => {
    const original = withFileOnDisk();
    const { created } = await newVersion([text('alt')], original, { file: null }, medias);
    expect(created[0].file).toBeNull();
  });
});
