import { RimeFormError } from '#lib/core/errors/index.js';
import { block, blocks } from '#lib/fields/blocks/index.js';
import { group } from '#lib/fields/group/index.js';
import { relation } from '#lib/fields/relation/index.js';
import { tab, tabs } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import { describe, expect, test, vi } from 'vitest';
import { buildConfigMap } from '../config-map/index.js';
import { saveRelations } from '../persist/relations/index.server.js';
import { completeNewRows } from './complete-new-rows.server.js';
import { validateFields } from './validate-fields.server.js';

/**
 * Guards the interaction between field-level write access and `required`.
 *
 * The two can contradict each other: the access block empties a field the request may not write,
 * and the required block then reports the now-empty field as missing — leaving the caller unable
 * to win, since it was not allowed to send the value that would satisfy the check.
 *
 * It is easy to read this as an auth-collection quirk, since that is where it shows up first
 * (`confirmPassword` with no `.access()` makes an anonymous `POST /api/users` 400 on a field it
 * could not send, instead of 403ing on access). It is not. `FormFieldBuilder` defaults to
 * `access.create: (user) => !!user`, so this hits *any* publicly-creatable collection whose
 * fields do not each override it — a sign-up form, a contact form, a comment.
 *
 * No e2e fixture covers it: they all declare `create: () => true` on the fields they post.
 */

const runValidate = (args: {
  fields: FieldBuilder<Field>[];
  data: Record<string, unknown>;
  user?: unknown;
  /** The unique lookup: `rime.collection(slug).system().find`. */
  find?: (args: any) => Promise<unknown[]>;
  /** An update of this document, instead of a create. */
  originalDoc?: { id: string; [key: string]: unknown };
  search?: string;
}) => {
  const config = { slug: 'members', fields: args.fields } as any;
  const find = args.find ?? (async () => []);

  const event = {
    url: new URL(`http://localhost/api/members${args.search ?? ''}`),
    locals: {
      user: args.user,
      locale: undefined,
      rime: {
        config: { isCollection: () => true },
        collection: () => ({ system: () => ({ find }) })
      }
    }
  } as any;

  return validateFields({
    data: args.data,
    config,
    event,
    operation: args.originalDoc ? 'update' : 'create',
    context: {
      params: {},
      originalDoc: args.originalDoc,
      originalConfigMap: args.originalDoc && buildConfigMap(args.originalDoc, args.fields),
      configMap: buildConfigMap(args.data, args.fields)
    }
  } as any);
};

describe('validateFields: required vs. field access on create', () => {
  test('a required field the request may not write is dropped, not reported missing', async () => {
    // No .access() — so it keeps FormFieldBuilder's default `create: (user) => !!user`,
    // which an anonymous request fails.
    const fields = [text('nickname').required()];

    const result = await runValidate({ fields, data: { nickname: 'anon' }, user: undefined });

    // Dropped from both the data and the config map, exactly as before...
    expect(result.data).not.toHaveProperty('nickname');
    expect(result.context.configMap).not.toHaveProperty('nickname');
  });

  test('...and that drop does not turn into an unsatisfiable REQUIRED_FIELD', async () => {
    const fields = [text('nickname').required()];

    // An anonymous create must resolve here rather than throw.
    await expect(
      runValidate({ fields, data: { nickname: 'anon' }, user: undefined })
    ).resolves.toBeDefined();
  });

  test('required still fires when the request may write the field but sent nothing', async () => {
    const fields = [text('nickname').required()];

    const promise = runValidate({ fields, data: { nickname: '' }, user: { id: 'u1' } });

    await expect(promise).rejects.toThrowError(RimeFormError);
    await expect(promise).rejects.toMatchObject({
      errors: { nickname: RimeFormError.REQUIRED_FIELD }
    });
  });

  test('required still fires for an anonymous request on a field opened to it', async () => {
    const fields = [
      text('nickname')
        .required()
        .access({ create: () => true })
    ];

    const promise = runValidate({ fields, data: { nickname: '' }, user: undefined });

    await expect(promise).rejects.toMatchObject({
      errors: { nickname: RimeFormError.REQUIRED_FIELD }
    });
  });
});

describe('validateFields: a container sent as null', () => {
  const fields = [
    tabs(tab('attributes').fields(text('title').required(), text('summary'))),
    group('seo').fields(text('metaTitle').required())
  ];

  test('reports each required field below it missing', async () => {
    const promise = runValidate({
      fields,
      data: { attributes: null, seo: null },
      user: { id: 'u1' },
      originalDoc: { id: 'p1' }
    });

    await expect(promise).rejects.toMatchObject({
      errors: {
        'attributes.title': RimeFormError.REQUIRED_FIELD,
        'seo.metaTitle': RimeFormError.REQUIRED_FIELD
      }
    });
  });

  test('leaves a container that is absent alone', async () => {
    await expect(
      runValidate({ fields, data: {}, user: { id: 'u1' }, originalDoc: { id: 'p1' } })
    ).resolves.toBeDefined();
  });
});

/**
 * A relation names documents that exist, checked before anything is written. A stale id fails
 * the save; it is never dropped from it, which used to leave the save to delete its row.
 */
describe('validateFields: relations name documents that exist', () => {
  /** `m1` and `m2` exist in medias; anything else does not. */
  const existing = ['m1', 'm2'];

  const runRelation = (args: {
    data: Record<string, unknown>;
    user?: unknown;
    search?: string;
    missing?: (args: { relationTo: string; ids: string[] }) => Promise<string[]>;
  }) => {
    // Cast: `medias` is only a registered slug in the fixture that declares it.
    const fields = [(relation('image') as any).to('medias').many()] as FieldBuilder<Field>[];
    const missing = vi.fn(
      args.missing ??
        (async ({ ids }: { ids: string[] }) => ids.filter((id) => !existing.includes(id)))
    );
    const event = {
      url: new URL(`http://localhost/api/members${args.search ?? ''}`),
      locals: {
        user: 'user' in args ? args.user : { id: 'u1' },
        locale: undefined,
        rime: { config: { isCollection: () => true }, adapter: { relations: { missing } } }
      }
    } as any;
    const promise = validateFields({
      data: args.data,
      config: { slug: 'members', fields } as any,
      event,
      operation: 'create',
      context: { params: {}, configMap: buildConfigMap(args.data, fields) }
    } as any);
    return { promise, missing };
  };

  test('a document that does not exist fails the save', async () => {
    const { promise, missing } = runRelation({ data: { image: ['m1', 'gone'] } });

    await expect(promise).rejects.toMatchObject({
      errors: { image: RimeFormError.RELATION_NOT_FOUND }
    });
    expect(missing).toHaveBeenCalledWith({ relationTo: 'medias', ids: ['m1', 'gone'] });
  });

  test('documents that exist pass, untouched, in one query', async () => {
    const value = ['m1', { relationTo: 'medias', documentId: 'm2' }];
    const { promise, missing } = runRelation({ data: { image: value } });

    expect(((await promise) as any).data.image).toEqual(value);
    expect(missing).toHaveBeenCalledTimes(1);
  });

  test('a check that fails fails the save, it never drops the relation', async () => {
    const { promise } = runRelation({
      data: { image: ['m1'] },
      missing: async () => {
        throw new Error('database is locked');
      }
    });

    await expect(promise).rejects.toThrow('database is locked');
  });

  test('?skipValidation=true from staff still checks the relations', async () => {
    const { promise, missing } = runRelation({
      data: { image: ['gone'] },
      user: { id: 'u1', isStaff: true },
      search: '?skipValidation=true'
    });

    await expect(promise).rejects.toMatchObject({
      errors: { image: RimeFormError.RELATION_NOT_FOUND }
    });
    expect(missing).toHaveBeenCalled();
  });

  test('a relation the request may not write is not checked, it is dropped', async () => {
    // relation() keeps FormFieldBuilder's default `create: (user) => !!user`.
    const { promise, missing } = runRelation({ data: { image: ['gone'] }, user: undefined });

    expect(((await promise) as any).data).not.toHaveProperty('image');
    expect(missing).not.toHaveBeenCalled();
  });
});

describe('validateFields: empty values', () => {
  const user = { id: 'u1' };

  test('an optional email sent empty is accepted', async () => {
    const { email } = await import('#lib/fields/email/index.js');
    const result = await runValidate({ fields: [email('contact')], data: { contact: '' }, user });
    expect(result.data.contact).toBe('');
  });

  test('a number sent empty is stored as no number', async () => {
    const { number } = await import('#lib/fields/number/index.js');
    const result = await runValidate({ fields: [number('stock')], data: { stock: '' }, user });
    expect(result.data.stock).toBeNull();
  });

  test('a required rich text with an empty document is reported missing', async () => {
    const { richText } = await import('#lib/fields/rich-text/index.js');
    const promise = runValidate({
      fields: [richText('body').required()],
      data: { body: { type: 'doc', content: [{ type: 'paragraph' }] } },
      user
    });
    await expect(promise).rejects.toMatchObject({
      errors: { body: RimeFormError.REQUIRED_FIELD }
    });
  });
});

describe('validateFields: unique', () => {
  const user = { id: 'u1' };

  test('the value is looked up as sent', async () => {
    const find = vi.fn().mockResolvedValue([{ id: 'other' }]);
    const promise = runValidate({
      fields: [text('code').unique()],
      data: { code: 'a+b' },
      user,
      find
    });

    await expect(promise).rejects.toMatchObject({ errors: { code: RimeFormError.UNIQUE_FIELD } });
    expect(find.mock.calls[0][0].query).toEqual({ where: { code: { equals: 'a+b' } } });
  });

  test('an update looks for the value on another document', async () => {
    const find = vi.fn().mockResolvedValue([]);
    await runValidate({
      fields: [text('code').unique()],
      data: { code: 'a&b%41' },
      user,
      find,
      originalDoc: { id: 'd1' }
    });

    expect(find.mock.calls[0][0].query).toEqual({
      where: { and: [{ code: { equals: 'a&b%41' } }, { id: { not_equals: 'd1' } }] }
    });
  });

  test('an empty value is not looked up', async () => {
    const find = vi.fn().mockResolvedValue([{ id: 'other' }]);
    await runValidate({ fields: [text('code').unique()], data: { code: '' }, user, find });
    await runValidate({ fields: [text('code').unique()], data: {}, user, find });

    expect(find).not.toHaveBeenCalled();
  });

  test('the value is looked up as beforeSave leaves it', async () => {
    const find = vi.fn().mockResolvedValue([]);
    await runValidate({
      fields: [
        text('code')
          .unique()
          .$beforeSave((value) => String(value).toLowerCase())
      ],
      data: { code: 'AB' },
      user,
      find
    });

    expect(find.mock.calls[0][0].query).toEqual({ where: { code: { equals: 'ab' } } });
  });
});

describe('validateFields: a field the request may not write', () => {
  const user = { id: 'u1' };

  test('a denied group takes its members out of the map', async () => {
    const fields = [
      group('meta')
        .access({ create: () => false })
        .fields(text('title').required())
    ];
    const result = await runValidate({ fields, data: { meta: { title: 'x' } }, user });

    expect(result.data).not.toHaveProperty('meta');
    expect(result.context.configMap).toEqual({});
  });

  test('a denied group on an update takes its relation out of the map', async () => {
    // Cast: `users` is only a registered slug in the fixture that declares it.
    const author = (relation('author') as any).to('users');
    const fields = [
      group('meta')
        .access({ update: () => false })
        .fields(author)
    ];
    const result = await runValidate({
      fields,
      data: { meta: { author: ['u2'] } },
      user,
      originalDoc: { id: 'd1' }
    });

    expect(result.context.configMap).not.toHaveProperty('meta.author');
  });

  test('a denied field is not looked up and reports nothing', async () => {
    const find = vi.fn().mockResolvedValue([{ id: 'other' }]);
    const fields = [
      text('code')
        .unique()
        .access({ create: () => false })
    ];
    const result = await runValidate({ fields, data: { code: 'a' }, user, find });

    expect(find).not.toHaveBeenCalled();
    expect(result.data).not.toHaveProperty('code');
  });
});

describe('validateFields: ?skipValidation=true', () => {
  const staff = { id: 'u1', isStaff: true };
  const search = '?skipValidation=true';

  test('from a caller who is not staff changes nothing', async () => {
    const promise = runValidate({
      fields: [text('nickname').required()],
      data: { nickname: '' },
      user: { id: 'u1' },
      search
    });

    await expect(promise).rejects.toMatchObject({
      errors: { nickname: RimeFormError.REQUIRED_FIELD }
    });
  });

  test('from staff still runs beforeSave', async () => {
    const result = await runValidate({
      fields: [text('bio').$beforeSave(() => 'clean')],
      data: { bio: '<img src=x onerror=alert(1)>' },
      user: staff,
      search
    });

    expect(result.data.bio).toBe('clean');
  });

  test('from staff leaves a required number sent empty out of the data', async () => {
    const { number } = await import('#lib/fields/number/index.js');
    const result = await runValidate({
      fields: [number('width').required()],
      data: { width: null },
      user: staff,
      search
    });

    expect(result.data).not.toHaveProperty('width');
  });
});

describe('validateFields: a denied field inside a list row', () => {
  const user = { id: 'u1' };
  // Cast: `medias` is only a registered slug in the fixture that declares it.
  const image = (relation('image') as any).to('medias').access({ update: () => false });
  const fields = [
    blocks('layout', [
      block('hero').fields(text('title'), image),
      block('note').fields(text('title'))
    ])
  ] as any[];

  /** A stored junction row of `layout.<index>.image`. */
  const ref = (id: string, documentId: string) => ({ id, relationTo: 'medias', documentId });
  const stored = {
    id: 'p1',
    layout: [
      { id: 'b1', type: 'hero', title: 'A', image: [ref('r1', 'm1')] },
      { id: 'b2', type: 'hero', title: 'B', image: [ref('r2', 'm2')] }
    ]
  };

  test('a stored row takes its stored value, sent or not', async () => {
    const result = await runValidate({
      fields,
      user,
      originalDoc: stored,
      data: {
        layout: [
          { id: 'b1', type: 'hero', title: 'A, edited' },
          { id: 'b2', type: 'hero', title: 'B', image: ['m9'] }
        ]
      }
    });

    expect(result.data.layout[0].image).toEqual([ref('r1', 'm1')]);
    expect(result.data.layout[1].image).toEqual([ref('r2', 'm2')]);
    expect(result.context.configMap).toHaveProperty('layout.0.image');
    expect(result.context.configMap).toHaveProperty('layout.1.image');
  });

  test('a new row drops it', async () => {
    const result = await runValidate({
      fields,
      user,
      originalDoc: stored,
      data: { layout: [{ type: 'hero', title: 'New', image: ['m9'] }] }
    });

    expect(result.data.layout[0]).not.toHaveProperty('image');
    expect(result.context.configMap).not.toHaveProperty('layout.0.image');
  });

  test('a stored row sent as another block type takes nothing', async () => {
    const result = await runValidate({
      fields,
      user,
      originalDoc: stored,
      data: { layout: [{ id: 'b1', type: 'note', title: 'A' }] }
    });

    expect(result.data.layout[0]).not.toHaveProperty('image');
    expect(result.context.configMap).not.toHaveProperty('layout.0.image');
  });

  test('a reordered list keeps each row its own relation', async () => {
    const result = await runValidate({
      fields,
      user,
      originalDoc: stored,
      data: {
        layout: [
          { id: 'b2', type: 'hero', title: 'B' },
          { id: 'b1', type: 'hero', title: 'A' }
        ]
      }
    });

    const rows = stored.layout.flatMap((row, index) =>
      row.image.map((entry) => ({ ...entry, path: `layout.${index}.image`, position: 0 }))
    );
    const relations = {
      getAll: vi.fn(async () => rows),
      deleteFromPaths: vi.fn(async () => true),
      delete: vi.fn(async () => true),
      update: vi.fn(async () => true),
      create: vi.fn(async () => true)
    };
    const noDiff = { toAdd: [], toDelete: [], toUpdate: [] };
    await saveRelations({
      data: result.data,
      configMap: result.context.configMap!,
      incomingPaths: Object.keys(result.context.configMap!),
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      adapter: { relations } as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });

    expect(relations.delete).not.toHaveBeenCalled();
    expect(relations.create).not.toHaveBeenCalled();
    const moved = relations.update.mock.calls.flatMap(([args]: any) => args.relations);
    expect(moved.map(({ id, path }: any) => ({ id, path }))).toEqual(
      expect.arrayContaining([
        { id: 'r2', path: 'layout.0.image' },
        { id: 'r1', path: 'layout.1.image' }
      ])
    );
    expect(moved).toHaveLength(2);
  });
});

describe('validateFields: a block row sent without a required field', () => {
  const user = { id: 'u1' };
  const fields = [blocks('layout', [block('call_to_action').fields(text('title').required())])];

  /** The data as the pipeline hands it to `validateFields`: its new rows completed. */
  const run = async (data: Record<string, unknown>, originalDoc?: { id: string }) => {
    const completed = await completeNewRows({ config: { fields }, data, event: {} } as any);
    return runValidate({ fields, data: (completed as any).data, user, originalDoc });
  };

  test('a new row is refused at layout.0.title', async () => {
    await expect(run({ layout: [{ type: 'call_to_action' }] })).rejects.toMatchObject({
      errors: { 'layout.0.title': RimeFormError.REQUIRED_FIELD }
    });
  });

  test('a stored row passes: it keeps its stored title', async () => {
    const stored = { id: 'p1', layout: [{ id: 'b1', type: 'call_to_action', title: 'Act now' }] };
    const result = await run({ layout: [{ id: 'b1', type: 'call_to_action' }] }, stored);

    // No title in the data nor in the map: the save leaves the stored one as it is
    expect(result.data.layout).toEqual([{ id: 'b1', type: 'call_to_action' }]);
    expect(result.context.configMap).not.toHaveProperty(['layout.0.title']);
  });
});
