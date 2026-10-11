import { blocks, block } from '#lib/fields/blocks/index.js';
import { group } from '#lib/fields/group/index.js';
import { number } from '#lib/fields/number/index.js';
import { richText } from '#lib/fields/rich-text/index.js';
import { tab, tabs } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';
import { tree } from '#lib/fields/tree/index.js';
import { describe, expect, it, vi } from 'vitest';
import type { Dic } from '#lib/util/types.js';
import { copyValues, duplicate } from './duplicate.js';

/** A collection of `fields`, in a request whose collection holds no value yet. */
const argsFor = (fields: any[], extra: object = {}) => {
  const find = async () => [];
  const event = { locals: { rime: { collection: () => ({ system: () => ({ find }) }) } } } as any;
  return { event, config: { slug: 'pages', fields } as any, locale: 'en', ...extra };
};

describe('copyValues', () => {
  it('gives each field the value of its hooks, and leaves a field with none', async () => {
    const fields = [
      text('title').isTitle(),
      text('code').$beforeDuplicate(() => null),
      text('note')
    ];
    const data = { title: 'Sale', code: 'A1', note: 'Kept' };
    expect(await copyValues(data, argsFor(fields))).toEqual({
      title: 'Sale (copy)',
      code: null,
      note: 'Kept'
    });
  });

  it('runs an app hook after the field’s own copy', async () => {
    const fields = [
      text('title')
        .isTitle()
        .$beforeDuplicate((title) => title.toUpperCase())
    ];
    expect(await copyValues({ title: 'Sale' }, argsFor(fields))).toEqual({ title: 'SALE (COPY)' });
  });

  it('reaches the fields inside a group and blocks', async () => {
    const fields = [
      group('meta').fields(text('code').$beforeDuplicate(() => 'NEW')),
      blocks('sections', [block('note').fields(text('code').$beforeDuplicate(() => 'NEW'))])
    ];
    const data = {
      meta: { code: 'A1' },
      sections: [{ id: 'b1', type: 'note', path: 'sections', position: 0, code: 'A1' }]
    };
    const copied = await copyValues(data, argsFor(fields));
    expect(copied.meta.code).toBe('NEW');
    expect(copied.sections[0].code).toBe('NEW');
  });

  it('keeps a change to a field inside a group whose own hook gives the group back', async () => {
    const fields = [
      group('meta')
        .fields(text('code').$beforeDuplicate(() => 'NEW'))
        .$beforeDuplicate((meta) => meta)
    ];
    const copied = await copyValues({ meta: { code: 'A1' } }, argsFor(fields));
    expect(copied.meta.code).toBe('NEW');
  });

  it('gives another locale the target value of a field that is not localized', async () => {
    const fields = [text('title').isTitle(), text('label').localized().isTitle()];
    const target = { title: 'Sale (copy 2)', label: 'Vente (copy)' };
    const copied = await copyValues({ title: 'Sale', label: 'Sale' }, argsFor(fields, { target }));
    expect(copied.title).toBe('Sale (copy 2)');
    expect(copied.label).toBe('Sale (copy)');
  });

  it('runs the hooks of a container that is not localized in another locale', async () => {
    const fields = [
      group('meta')
        .fields(number('n'))
        .$beforeDuplicate(() => ({ n: 2 }))
    ];
    const target = { meta: { n: 1 } };
    const copied = await copyValues({ meta: { n: 1 } }, argsFor(fields, { target }));
    expect(copied.meta).toEqual({ n: 2 });
  });

  it('keeps the locale value of a field inside a localized group, blocks or tree', async () => {
    const fields = [
      group('meta').fields(text('label')).localized(),
      blocks('sections', [block('note').fields(text('label'))]).localized(),
      tree('links').fields(text('label')).localized()
    ];
    const row = { path: 'sections', position: 0 };
    const data = {
      meta: { label: 'Bonjour' },
      sections: [{ ...row, type: 'note', label: 'Bonjour' }],
      links: [{ path: 'links', position: 0, label: 'Bonjour' }]
    };
    const target = {
      meta: { label: 'Hello' },
      sections: [{ ...row, id: 'b1', type: 'note', label: 'Hello' }],
      links: [{ id: 't1', path: 'links', position: 0, label: 'Hello' }]
    };
    const copied = await copyValues(data, argsFor(fields, { target }));
    expect(copied.meta.label).toBe('Bonjour');
    expect(copied.sections[0].label).toBe('Bonjour');
    expect(copied.links[0].label).toBe('Bonjour');
  });

  it('keeps the locale value of a field inside tabs in a localized group', async () => {
    const fields = [
      group('meta')
        .fields(tabs(tab('seo').fields(text('title'))))
        .localized()
    ];
    const target = { meta: { seo: { title: 'Sale' } } };
    const copied = await copyValues(
      { meta: { seo: { title: 'Soldes' } } },
      argsFor(fields, { target })
    );
    expect(copied.meta.seo.title).toBe('Soldes');
  });
});

describe('duplicate', () => {
  it('keeps the document a rich-text node points at', async () => {
    const fields = [richText('body'), blocks('sections', [block('text').fields(richText('body'))])];
    const body = {
      type: 'doc',
      content: [{ type: 'resource', attrs: { id: 'p1', title: 'About' } }]
    };
    const source = { id: 'doc', body, sections: [{ id: 'b1', type: 'text', body }] };

    const created: Dic[] = [];
    const collection = {
      findById: async () => structuredClone(source),
      create: async ({ data }: Dic) => {
        created.push(data);
        return { id: 'copy' };
      }
    };
    const rime = {
      collection: () => collection,
      config: { getDefaultLocale: () => undefined, getLocalesCodes: () => [] }
    };
    const config = { type: 'collection', slug: 'pages', fields } as any;

    await duplicate({ id: 'doc', ctx: { config, event: { locals: { rime } } } as any });

    expect(created).toHaveLength(1);
    expect(created[0].body).toEqual(body);
    expect(created[0].sections).toEqual([{ type: 'text', body }]);
  });

  it('keeps the status of a config without drafts: it is the author’s own field', async () => {
    const fields = [text('title'), text('status')];
    const created: Dic[] = [];
    const collection = {
      findById: async () => ({ id: 'doc', title: 'Ticket', status: 'closed' }),
      create: async ({ data }: Dic) => {
        created.push(data);
        return { id: 'copy' };
      }
    };
    const rime = {
      collection: () => collection,
      config: { getDefaultLocale: () => undefined, getLocalesCodes: () => [] }
    };
    const config = { type: 'collection', slug: 'tickets', fields } as any;

    await duplicate({ id: 'doc', ctx: { config, event: { locals: { rime } } } as any });

    expect(created[0].status).toBe('closed');
  });

  it('creates the copy with its references as ids, new rows, and no status', async () => {
    const fields = [
      text('title'),
      text('owner').$references('staff', { resolve: true }),
      blocks('sections', [block('text').fields(text('body'))])
    ];
    // The source as a read hands it back: the owner resolved, each row with its id and metas
    const source = {
      id: 'doc',
      title: 'Hello',
      status: 'published',
      owner: { id: 'u1', name: 'Ann' },
      sections: [{ id: 'b1', ownerId: 'doc', createdAt: '2025-01-01', type: 'text', body: 'Kept' }]
    };

    const created: Dic[] = [];
    const collection = {
      findById: async () => structuredClone(source),
      create: async ({ data }: Dic) => {
        created.push(data);
        return { id: 'copy' };
      }
    };
    const rime = {
      collection: () => collection,
      config: { getDefaultLocale: () => undefined, getLocalesCodes: () => [] }
    };
    const config = { type: 'collection', slug: 'pages', fields, versions: { draft: true } } as any;

    await duplicate({ id: 'doc', ctx: { config, event: { locals: { rime } } } as any });

    expect(created).toEqual([
      { title: 'Hello', owner: 'u1', sections: [{ type: 'text', body: 'Kept' }] }
    ]);
  });

  it("names the default locale on its reads and writes, and leaves the request's locale alone", async () => {
    const calls: Dic[] = [];
    const collection = {
      findById: async (args: Dic) => {
        calls.push(args);
        return { id: 'doc', title: 'Hello' };
      },
      create: async (args: Dic) => {
        calls.push(args);
        return { id: 'copy' };
      }
    };
    const setLocale = vi.fn();
    const rime = {
      collection: () => collection,
      setLocale,
      config: { getDefaultLocale: () => 'en', getLocalesCodes: () => ['en'] }
    };
    const config = { type: 'collection', slug: 'pages', fields: [text('title')] } as any;
    const event = { locals: { rime, locale: 'fr' } };

    await duplicate({ id: 'doc', ctx: { config, event } as any });

    expect(calls.map((call) => call.locale)).toEqual(['en', 'en']);
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('reads the newest row for staff and rime, the published one for anyone else', async () => {
    /** The `latest` the source is read with, for `user` or a `.system()` call. */
    const latestFor = async (args: { user?: Dic; system?: boolean }) => {
      const reads: Dic[] = [];
      const collection = {
        findById: async (read: Dic) => {
          reads.push(read);
          return { id: 'doc', title: 'Hello' };
        },
        create: async () => ({ id: 'copy' })
      };
      const rime = {
        collection: () => collection,
        config: { getDefaultLocale: () => 'en', getLocalesCodes: () => ['en'] }
      };
      const config = { type: 'collection', slug: 'pages', fields: [text('title')] } as any;
      const event = { locals: { rime, user: args.user } };
      await duplicate({
        id: 'doc',
        ctx: { config, event, isSystemOperation: args.system } as any
      });
      return reads[0].latest;
    };

    expect(await latestFor({ user: { id: 's1', isStaff: true } })).toBe(true);
    expect(await latestFor({ system: true })).toBe(true);
    expect(await latestFor({ user: { id: 'u1' } })).toBeUndefined();
  });
});
