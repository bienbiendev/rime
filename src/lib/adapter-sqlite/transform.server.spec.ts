import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '#lib/core/logger.server.js';
import { baseTableName, tableName } from './naming.server.js';
import { createTransformHandle, resolveRelationTarget } from './transform.server.js';

describe('resolveRelationTarget', () => {
  it('reads a slug that contains Id back whole', () => {
    const row = resolveRelationTarget({
      id: 'r1',
      ownerId: 'p1',
      path: 'idea',
      productIdeasId: 'd1',
      mediasId: null
    });
    expect(row).toMatchObject({ relationTo: 'productIdeas', documentId: 'd1' });
    expect(row).not.toHaveProperty('productIdeasId');
    expect(row).not.toHaveProperty('mediasId');
  });

  it('reads a plain slug back', () => {
    expect(resolveRelationTarget({ ownerId: 'p1', mediasId: 'm1' })).toMatchObject({
      relationTo: 'medias',
      documentId: 'm1'
    });
  });
});

describe('rows', () => {
  const configs: Record<string, unknown> = {
    infos: { slug: 'infos', type: 'area', fields: [] },
    pages: { slug: 'pages', type: 'collection', fields: [] }
  };
  const configCtx = { getBySlug: (slug: string) => configs[slug] } as any;
  const { rows } = createTransformHandle({ configCtx, tables: {} });

  /** The row a read joins from the paths table of `slug`. */
  const withAddress = (slug: string, address: Record<string, string>) =>
    ({
      id: 'd1',
      [tableName({ owner: baseTableName(slug), child: { kind: 'paths' } })]: [address]
    }) as any;

  it("gives an area's document its url alone", async () => {
    const doc = withAddress('infos', { slug: 'infos', path: 'infos', url: 'https://site.com/fr' });
    const { base } = await rows({ doc, slug: 'infos' as any });
    expect(base.url).toBe('https://site.com/fr');
    expect(base).not.toHaveProperty('_urlPath');
    expect(base).not.toHaveProperty('_slug');
  });

  it("gives a page's document its url, its path and its slug", async () => {
    const doc = withAddress('pages', {
      slug: 'web',
      path: 'services/web',
      url: 'https://site.com/web'
    });
    const { base } = await rows({ doc, slug: 'pages' as any });
    expect(base).toMatchObject({
      url: 'https://site.com/web',
      _urlPath: 'services/web',
      _slug: 'web'
    });
  });
});

describe('rows, in a locale', () => {
  // A `pages` collection with a localized title and summary, a `hero` block with a localized
  // title and caption, and a `nav` tree with a localized label
  const tables = {
    pages: sqliteTable('pages', { id: text('id').primaryKey() }),
    pages__$$locales: sqliteTable('pages__$$locales', {
      id: text('id').primaryKey(),
      ownerId: text('owner_id'),
      locale: text('locale'),
      title: text('title'),
      summary: text('summary')
    }),
    pages__$blocks_hero: sqliteTable('pages__$blocks_hero', {
      id: text('id').primaryKey(),
      ownerId: text('owner_id'),
      path: text('path'),
      position: integer('position'),
      type: text('type'),
      cta__label: text('cta__label')
    }),
    pages__$blocks_hero__$$locales: sqliteTable('pages__$blocks_hero__$$locales', {
      id: text('id').primaryKey(),
      ownerId: text('owner_id'),
      locale: text('locale'),
      title: text('title'),
      caption: text('caption')
    }),
    pages__$tree_nav: sqliteTable('pages__$tree_nav', {
      id: text('id').primaryKey(),
      ownerId: text('owner_id'),
      path: text('path'),
      position: integer('position')
    }),
    pages__$tree_nav__$$locales: sqliteTable('pages__$tree_nav__$$locales', {
      id: text('id').primaryKey(),
      ownerId: text('owner_id'),
      locale: text('locale'),
      label: text('label')
    })
  };
  // French and English, English by default
  const configCtx = {
    getBySlug: () => ({ slug: 'pages', type: 'collection', fields: [] }),
    raw: { localization: { locales: [{ code: 'fr' }, { code: 'en' }], default: 'en' } },
    getLocalesCodes: () => ['fr', 'en']
  } as any;
  const { rows } = createTransformHandle({ configCtx, tables });

  /** A page as a read returns it: a title in both locales, a summary in English only. */
  const page = () =>
    ({
      id: 'd1',
      pages__$$locales: [
        { id: 'l1', ownerId: 'd1', locale: 'fr', title: 'Accueil', summary: null },
        { id: 'l2', ownerId: 'd1', locale: 'en', title: 'Home', summary: 'Welcome' }
      ]
    }) as any;

  it('takes each localized value from the first locale that holds it', async () => {
    const fr = await rows({ doc: page(), slug: 'pages' as any, locale: 'fr' });
    expect(fr.base).toEqual({ id: 'd1', title: 'Accueil', summary: 'Welcome' });

    const en = await rows({ doc: page(), slug: 'pages' as any, locale: 'en' });
    expect(en.base).toEqual({ id: 'd1', title: 'Home', summary: 'Welcome' });
  });

  it('keeps to the locale read when the fallback is off', async () => {
    const { base } = await rows({
      doc: page(),
      slug: 'pages' as any,
      locale: 'fr',
      localeFallback: false
    });
    expect(base).toEqual({ id: 'd1', title: 'Accueil', summary: null });
  });

  it("merges a block's locales branch onto it, null where no locale has a value", async () => {
    const doc = {
      id: 'd1',
      pages__$blocks_hero: [
        {
          id: 'b1',
          ownerId: 'd1',
          path: 'layout',
          position: 0,
          type: 'hero',
          cta__label: 'Go',
          pages__$blocks_hero__$$locales: [
            { id: 'bl1', ownerId: 'b1', locale: 'fr', title: 'Bonjour', caption: null },
            { id: 'bl2', ownerId: 'b1', locale: 'en', title: 'Hello', caption: 'Hi' }
          ]
        },
        {
          id: 'b2',
          ownerId: 'd1',
          path: 'layout',
          position: 1,
          type: 'hero',
          cta__label: null,
          pages__$blocks_hero__$$locales: []
        }
      ]
    } as any;

    const { base, blocks } = await rows({ doc, slug: 'pages' as any, locale: 'fr' });

    expect(blocks).toEqual([
      {
        id: 'b1',
        ownerId: 'd1',
        path: 'layout',
        position: 0,
        type: 'hero',
        'cta.label': 'Go',
        title: 'Bonjour',
        caption: 'Hi'
      },
      {
        id: 'b2',
        ownerId: 'd1',
        path: 'layout',
        position: 1,
        type: 'hero',
        'cta.label': null,
        title: null,
        caption: null
      }
    ]);
    expect(base).toEqual({ id: 'd1' });
  });

  it('reads the tree nodes by path, parents first, each with its locales branch', async () => {
    const doc = {
      id: 'd1',
      pages__$tree_nav: [
        {
          id: 'n2',
          ownerId: 'd1',
          path: 'nav.0._children',
          position: 0,
          pages__$tree_nav__$$locales: [{ id: 'nl2', ownerId: 'n2', locale: 'en', label: 'Team' }]
        },
        {
          id: 'n1',
          ownerId: 'd1',
          path: 'nav',
          position: 0,
          pages__$tree_nav__$$locales: [
            { id: 'nl1', ownerId: 'n1', locale: 'fr', label: 'À propos' }
          ]
        }
      ]
    } as any;

    const { tree } = await rows({ doc, slug: 'pages' as any, locale: 'fr' });

    expect(tree).toEqual([
      { id: 'n1', ownerId: 'd1', path: 'nav', position: 0, label: 'À propos' },
      { id: 'n2', ownerId: 'd1', path: 'nav.0._children', position: 0, label: 'Team' }
    ]);
  });

  it('leaves out a tree node it cannot read, and logs which and why', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const doc = {
      id: 'd1',
      pages__$tree_nav: [
        { id: 'n1', ownerId: 'd1', path: 'nav', position: 0, pages__$tree_nav__$$locales: [null] }
      ]
    } as any;

    const { tree } = await rows({ doc, slug: 'pages' as any, locale: 'fr' });

    expect(tree).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('tree node n1 at nav'),
      expect.any(Error)
    );
    error.mockRestore();
  });

  it('turns columns into paths and flattens a JSON value under its own', async () => {
    const doc = {
      id: 'd1',
      seo__title: 'Title',
      meta: { colors: { main: 'red' } },
      gallery: ['a.jpg', 'b.jpg']
    } as any;

    const { base } = await rows({ doc, slug: 'pages' as any });

    expect(base).toEqual({
      id: 'd1',
      'seo.title': 'Title',
      'meta.colors.main': 'red',
      'gallery.0': 'a.jpg',
      'gallery.1': 'b.jpg'
    });
  });

  it('converts the column of a JSON value, never the keys inside it', async () => {
    const doc = { id: 'd1', body: { foo__bar: 1 }, group__data: { $x: 2 } } as any;

    const { base } = await rows({ doc, slug: 'pages' as any });

    expect(base).toEqual({ id: 'd1', 'body.foo__bar': 1, 'group.data.$x': 2 });
  });
});
