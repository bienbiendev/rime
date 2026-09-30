import { buildDocument } from '$lib/core/pipeline/build-document.server.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { mergeWithInitialDocument } from '$lib/core/prototype/collection/hooks/merge-with-initial.server.js';
import {
  block,
  blocks,
  checkbox,
  date,
  number,
  relation,
  text,
  toggle,
  tree
} from '$lib/fields/index.js';
import type { DefaultOptions } from '$lib/fields/types.js';
import { describe, expect, test, vi } from 'vitest';
import { processDocumentFields } from './process-document-fields.server.js';
import { setDefaultValues } from './set-default-values.server.js';

/**
 * Every field kind, with each fill, through a create, an update and a read: the hooks that give a
 * value its default, run in their order, without a database.
 *
 * ```
 *                                    fill: 'create'   fill: 'save'
 * POST   sent a value                the value        the value
 * POST   not sent                    the default      the default
 * POST   sent empty                  empty            the default
 * PATCH  sent a value                the value        the value
 * PATCH  not sent, stored a value    not touched      not touched
 * PATCH  not sent, stored empty      not touched      the default
 * PATCH  sent empty                  empty            the default
 * read   stored empty                empty            empty
 * ```
 */

vi.mock('$app/server', () => ({ getRequestEvent: () => ({}) }));

const adapter = {
  // A relation's default keeps the ids that name a document that exists: here, every one.
  collection: () => ({
    findMany: async ({ query }: any) => query.where.id.in_array.map((id: string) => ({ id }))
  })
};
const event = { locals: { user: undefined, rime: { adapter } }, params: {} };

const paragraph = block('paragraph').fields(text('text'));

type Kind = {
  name: string;
  field: (options: DefaultOptions) => any;
  value: unknown;
  empty: unknown;
  /** Whether a value is the field's default, as the step that gave it hands it on. */
  isDefault: (value: any) => boolean;
};

const kinds: Kind[] = [
  {
    name: 'text',
    field: (options) => text('f').defaultValue('Default', options),
    value: 'Hello',
    empty: null,
    isDefault: (value) => value === 'Default'
  },
  {
    name: 'number',
    field: (options) => number('f').defaultValue(5, options),
    value: 0,
    empty: null,
    isDefault: (value) => value === 5
  },
  {
    name: 'toggle',
    field: (options) => toggle('f').defaultValue(true, options),
    value: false,
    empty: null,
    isDefault: (value) => value === true
  },
  {
    name: 'checkbox',
    field: (options) => checkbox('f').defaultValue(true, options),
    value: false,
    empty: null,
    isDefault: (value) => value === true
  },
  {
    name: 'date',
    field: (options) => date('f').defaultValue(() => new Date(), options),
    value: new Date('2026-01-01'),
    empty: null,
    isDefault: (value) => value instanceof Date && Date.now() - value.getTime() < 60_000
  },
  {
    name: 'relation',
    // Cast: `targets` is only a registered slug in the fixture that declares it.
    field: (options) => (relation('f') as any).to('targets').defaultValue('target-1', options),
    value: [{ relationTo: 'targets', documentId: 'target-2' }],
    empty: [],
    // The initial document hands the id as it is; a save hands the relation it checked.
    isDefault: (value) =>
      value === 'target-1' || (Array.isArray(value) && value[0]?.documentId === 'target-1')
  },
  {
    name: 'blocks',
    field: (options) =>
      blocks('f', [paragraph]).defaultValue([{ type: 'paragraph', text: 'Default' }], options),
    value: [{ id: 'b', type: 'paragraph', text: 'Mine' }],
    empty: [],
    isDefault: (value) => value?.[0]?.text === 'Default' && value[0].id.startsWith('temp-')
  },
  {
    name: 'tree',
    field: (options) =>
      tree('f')
        .fields(text('label'))
        .defaultValue([{ label: 'Default' }], options),
    value: [{ id: 't', label: 'Mine', _children: [] }],
    empty: [],
    isDefault: (value) => value?.[0]?.label === 'Default' && value[0].id.startsWith('temp-')
  }
];

let configs = 0;
const configWith = (field: any) =>
  create(`spec_defaults_${configs++}`, { fields: [text('title').isTitle(), field] }) as any;

const post = async (config: any, data: Record<string, unknown>) => {
  const args = { config, data, event, context: {}, operation: 'create' } as any;
  const merged = await mergeWithInitialDocument(args);
  return ((await setDefaultValues(merged as any)) as any).data;
};

const patch = async (config: any, data: Record<string, unknown>, stored: Record<string, unknown>) =>
  (
    (await setDefaultValues({
      config,
      data,
      event,
      context: { originalDoc: stored },
      operation: 'update'
    } as any)) as any
  ).data;

const read = async (config: any) => {
  const rows = { base: { id: '1', title: 'T' }, blocks: [], tree: [], relations: [] };
  const doc = await buildDocument(rows as any, { config });
  return ((await processDocumentFields({ doc, config, event, context: {} } as any)) as any).doc;
};

for (const kind of kinds) {
  describe(`${kind.name}, fill 'create'`, () => {
    const config = configWith(kind.field({ fill: 'create' }));

    test('POST sent a value: the value', async () => {
      expect((await post(config, { f: kind.value })).f).toEqual(kind.value);
    });
    test('POST not sent: the default', async () => {
      expect(kind.isDefault((await post(config, {})).f)).toBe(true);
    });
    test('POST sent empty: empty', async () => {
      expect((await post(config, { f: kind.empty })).f).toEqual(kind.empty);
    });
    test('PATCH sent a value: the value', async () => {
      expect((await patch(config, { f: kind.value }, { f: kind.empty })).f).toEqual(kind.value);
    });
    test('PATCH not sent, stored a value: not touched', async () => {
      expect(await patch(config, { title: 'T' }, { f: kind.value })).not.toHaveProperty('f');
    });
    test('PATCH not sent, stored empty: not touched', async () => {
      expect(await patch(config, { title: 'T' }, { f: kind.empty })).not.toHaveProperty('f');
    });
    test('PATCH sent empty: empty', async () => {
      expect((await patch(config, { f: kind.empty }, { f: kind.value })).f).toEqual(kind.empty);
    });
    test('read, stored empty: empty', async () => {
      expect((await read(config)).f).toEqual(kind.empty);
    });
  });

  describe(`${kind.name}, fill 'save'`, () => {
    const config = configWith(kind.field({ fill: 'save' }));

    test('POST sent a value: the value', async () => {
      expect((await post(config, { f: kind.value })).f).toEqual(kind.value);
    });
    test('POST not sent: the default', async () => {
      expect(kind.isDefault((await post(config, {})).f)).toBe(true);
    });
    test('POST sent empty: the default', async () => {
      expect(kind.isDefault((await post(config, { f: kind.empty })).f)).toBe(true);
    });
    test('PATCH sent a value: the value', async () => {
      expect((await patch(config, { f: kind.value }, { f: kind.empty })).f).toEqual(kind.value);
    });
    test('PATCH not sent, stored a value: not touched', async () => {
      expect(await patch(config, { title: 'T' }, { f: kind.value })).not.toHaveProperty('f');
    });
    test('PATCH not sent, stored empty: the default', async () => {
      expect(kind.isDefault((await patch(config, { title: 'T' }, { f: kind.empty })).f)).toBe(true);
    });
    test('PATCH sent empty: the default', async () => {
      expect(kind.isDefault((await patch(config, { f: kind.empty }, { f: kind.value })).f)).toBe(
        true
      );
    });
    test('read, stored empty: empty', async () => {
      expect((await read(config)).f).toEqual(kind.empty);
    });
  });
}

test('a required field sent empty is not filled unless it says fill: save', async () => {
  const required = configWith(text('f').required().defaultValue('Default'));
  const saved = configWith(text('f').required().defaultValue('Default', { fill: 'save' }));

  expect((await post(required, { f: null })).f).toBe(null);
  expect((await post(saved, { f: null })).f).toBe('Default');
});

test('a value sent empty in a block takes its default when its field says fill: save', async () => {
  const note = block('note').fields(text('text').defaultValue('Default', { fill: 'save' }));
  const config = configWith(blocks('f', [note]));

  const data = await patch(config, { f: [{ id: 'b', type: 'note', text: null }] }, { f: [] });

  expect(data.f[0].text).toBe('Default');
});
