import { createClient } from '@libsql/client';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { block, blocks, relation, text as textField } from '#lib/fields/index.js';
import { buildWithParam } from './select.server.js';
import type { TableName } from './naming.server.js';

// A `pages` collection with a localized title, an author, and a `layout` of hero and text
// blocks. The hero block is localized: its table has a `locale` column and a locales branch.
const tables = {
  pages: sqliteTable('pages', { id: text('id').primaryKey() }),
  pages__$$locales: sqliteTable('pages__$$locales', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    locale: text('locale'),
    title: text('title')
  }),
  pages__$blocks_hero: sqliteTable('pages__$blocks_hero', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    locale: text('locale'),
    path: text('path'),
    position: integer('position')
  }),
  pages__$blocks_hero__$$locales: sqliteTable('pages__$blocks_hero__$$locales', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    locale: text('locale'),
    title: text('title')
  }),
  pages__$blocks_text: sqliteTable('pages__$blocks_text', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    path: text('path'),
    position: integer('position'),
    body: text('body')
  }),
  pages__$relations: sqliteTable('pages__$relations', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    path: text('path'),
    position: integer('position'),
    mediasId: text('medias_id'),
    staffId: text('staff_id')
  })
};

const config = {
  slug: 'pages',
  type: 'collection',
  fields: [
    textField('title').localized(),
    relation('author').to('staff' as never),
    blocks('layout', [
      block('hero').fields(textField('title').localized(), relation('image').to('medias' as never)),
      block('text').fields(textField('body'))
    ])
  ]
} as never;

const withOf = (args: { select?: string[]; locale?: string; fallback?: string[] }) =>
  buildWithParam({ table: 'pages' as TableName, tables, config, ...args });

const byPosition = { orderBy: { position: 'asc' } };
const byPathAndPosition = { orderBy: { path: 'asc', position: 'asc' } };

describe('buildWithParam', () => {
  it('joins the block tables and the junction rows below a selected blocks field', () => {
    expect(withOf({ select: ['layout'] })).toEqual({
      pages__$blocks_hero: byPosition,
      pages__$blocks_text: byPosition,
      pages__$relations: {
        where: { OR: [{ path: { gte: 'layout.', lt: 'layout/' } }] },
        ...byPathAndPosition
      }
    });
  });

  it("joins a selected relation's own rows, beside the rows below a block field", () => {
    expect(withOf({ select: ['author'] })).toEqual({
      pages__$relations: { where: { OR: [{ path: 'author' }] }, ...byPathAndPosition }
    });
    expect(withOf({ select: ['author', 'layout'], locale: 'fr' })).toEqual({
      pages__$blocks_hero: {
        ...byPosition,
        where: { locale: 'fr' },
        with: { pages__$blocks_hero__$$locales: { where: { locale: 'fr' } } }
      },
      pages__$blocks_text: byPosition,
      pages__$relations: {
        where: { OR: [{ path: { gte: 'layout.', lt: 'layout/' } }, { path: 'author' }] },
        ...byPathAndPosition
      }
    });
  });

  it('reads a selected localized column from the locales branch, in every locale of the order', () => {
    expect(withOf({ select: ['title'], locale: 'fr', fallback: ['fr', 'en'] })).toEqual({
      pages__$$locales: {
        where: { locale: { in: ['fr', 'en'] } },
        columns: { locale: true, title: true }
      }
    });
  });

  it('joins every child table and every locales branch with no select', () => {
    expect(withOf({ locale: 'fr', fallback: ['fr', 'en'] })).toEqual({
      pages__$$locales: { where: { locale: { in: ['fr', 'en'] } } },
      pages__$blocks_hero: {
        ...byPosition,
        where: { locale: 'fr' },
        with: { pages__$blocks_hero__$$locales: { where: { locale: { in: ['fr', 'en'] } } } }
      },
      pages__$blocks_text: byPosition,
      pages__$relations: byPathAndPosition
    });
  });
});

describe('the junction rows below a container', () => {
  // A `shelves` collection with two block lists whose names differ by the character `_` stands for
  const shelves = sqliteTable('shelves', { id: text('id').primaryKey() });
  const cards = sqliteTable('shelves__$blocks_card', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    path: text('path'),
    position: integer('position')
  });
  const rels = sqliteTable('shelves__$relations', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    path: text('path'),
    position: integer('position'),
    mediasId: text('medias_id')
  });
  const shelfTables = { shelves, shelves__$blocks_card: cards, shelves__$relations: rels };
  const relations = defineRelations(shelfTables, (r) => ({
    shelves: {
      shelves__$blocks_card: r.many.shelves__$blocks_card({
        from: r.shelves.id,
        to: r.shelves__$blocks_card.ownerId
      }),
      shelves__$relations: r.many.shelves__$relations({
        from: r.shelves.id,
        to: r.shelves__$relations.ownerId
      })
    }
  }));
  const card = () => block('card').fields(relation('image').to('medias' as never));
  const shelfConfig = {
    slug: 'shelves',
    type: 'collection',
    fields: [blocks('my_list', [card()]), blocks('myXlist', [card()])]
  } as never;

  it('are the rows under its path, not under a name a LIKE pattern also matches', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'rime-select-')), 'test.sqlite');
    const client = createClient({ url: `file:${file}` });
    await client.execute('CREATE TABLE `shelves` (`id` text PRIMARY KEY)');
    await client.execute(
      'CREATE TABLE `shelves__$blocks_card` (`id` text PRIMARY KEY, `owner_id` text, `path` text, `position` integer)'
    );
    await client.execute(
      'CREATE TABLE `shelves__$relations` (`id` text PRIMARY KEY, `owner_id` text, `path` text, `position` integer, `medias_id` text)'
    );
    const db = drizzle({ client, relations });
    await db.insert(shelves).values({ id: 's1' });
    await db.insert(rels).values([
      { id: 'r1', ownerId: 's1', path: 'my_list.0.image', position: 0, mediasId: 'm1' },
      { id: 'r2', ownerId: 's1', path: 'myXlist.0.image', position: 0, mediasId: 'm2' }
    ]);

    const read = await db.query.shelves.findMany({
      with: buildWithParam({
        table: 'shelves' as TableName,
        tables: shelfTables,
        config: shelfConfig,
        select: ['my_list']
      })
    });
    // The join is built at runtime, so its rows are not in the query's type
    const [shelf] = read as unknown as { shelves__$relations: { path: string }[] }[];

    expect(shelf.shelves__$relations.map((row) => row.path)).toEqual(['my_list.0.image']);
  });
});
