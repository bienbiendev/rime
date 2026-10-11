import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { date, number, relation, text as textField, toggle } from '#lib/fields/index.js';
import type { Dic } from '#lib/util/types.js';
import { buildWhereParam } from './where.server.js';

// A `products` collection as the schema generator writes it: a localized `slug`, a `tags`
// relation with many values, a `category` relation to a versioned collection, and a versions
// table.
const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku'),
  price: real('price'),
  active: integer('active', { mode: 'boolean' })
});
const products__$$locales = sqliteTable('products__$$locales', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  locale: text('locale'),
  slug: text('slug')
});
const products__$relations = sqliteTable('products__$relations', {
  id: text('id').primaryKey(),
  path: text('path'),
  position: integer('position'),
  ownerId: text('owner_id'),
  tagsId: text('tags_id'),
  categoriesId: text('categories_id')
});
const products__versions = sqliteTable('products__versions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  title: text('title')
});
const tags = sqliteTable('tags', { id: text('id').primaryKey(), name: text('name') });
// A versioned `categories`: its `title` lives on its versions table
const categories = sqliteTable('categories', { id: text('id').primaryKey() });
const categories__versions = sqliteTable('categories__versions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  title: text('title')
});

// An `items` collection: a text `code`, a date `at` and a localized `label`.
const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  code: text('code'),
  at: integer('at', { mode: 'timestamp_ms' })
});
const items__$$locales = sqliteTable('items__$$locales', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  locale: text('locale'),
  label: text('label')
});

const tables = {
  products,
  products__$$locales,
  products__$relations,
  products__versions,
  tags,
  categories,
  categories__versions,
  items,
  items__$$locales
};

const MIGRATION = [
  'CREATE TABLE `products` (`id` text PRIMARY KEY, `sku` text, `price` real, `active` integer)',
  'CREATE TABLE `products__$$locales` (`id` text PRIMARY KEY, `owner_id` text, `locale` text, `slug` text)',
  'CREATE TABLE `products__$relations` (`id` text PRIMARY KEY, `path` text, `position` integer, `owner_id` text, `tags_id` text, `categories_id` text)',
  'CREATE TABLE `products__versions` (`id` text PRIMARY KEY, `owner_id` text, `title` text)',
  'CREATE TABLE `tags` (`id` text PRIMARY KEY, `name` text)',
  'CREATE TABLE `categories` (`id` text PRIMARY KEY)',
  'CREATE TABLE `categories__versions` (`id` text PRIMARY KEY, `owner_id` text, `title` text)',
  'CREATE TABLE `items` (`id` text PRIMARY KEY, `code` text, `at` integer)',
  'CREATE TABLE `items__$$locales` (`id` text PRIMARY KEY, `owner_id` text, `locale` text, `label` text)'
];

const fields: Dic = {
  products: [
    textField('sku'),
    number('price'),
    toggle('active'),
    textField('slug').localized(),
    relation('tags')
      .to('tags' as never)
      .many(),
    relation('category').to('categories' as never)
  ],
  tags: [textField('name')],
  categories: [],
  $categories__versions: [textField('title')],
  items: [textField('code'), date('at'), textField('label').localized()]
};

// `categories` keeps its content on its versions table
const versioned: Dic = { categories: { slug: '$categories__versions' } };

// French and English, English by default: a read in fr falls back on en, field by field
const configCtx = {
  getBySlug: (slug: string) => ({ slug, fields: fields[slug], _versions: versioned[slug] }),
  raw: { localization: { locales: [{ code: 'fr' }, { code: 'en' }], default: 'en' } },
  getLocalesCodes: () => ['fr', 'en']
} as never;

let db: ReturnType<typeof drizzle>;

/**
 * ```
 *       sku     price  active  slug fr   slug en  tags              category
 * p1    sku-a   3      true    chaise    chair    t1 Red, t2 Blue   c1
 * p2    sku-b   5      false   (no row)  table    t1 Red            none
 * p3    sku-c   15     true    ''        lamp     none              c2
 * ```
 *
 * And three versions: v1 and v2 of p1, v3 of p2. The categories' titles are on their versions:
 * c1 'News' then 'News, renamed', c2 'Sport'.
 */
beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-where-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  db = drizzle({ client });

  await db.insert(products).values([
    { id: 'p1', sku: 'sku-a', price: 3, active: true },
    { id: 'p2', sku: 'sku-b', price: 5, active: false },
    { id: 'p3', sku: 'sku-c', price: 15, active: true }
  ]);
  await db.insert(products__$$locales).values([
    { id: 'l1', ownerId: 'p1', locale: 'fr', slug: 'chaise' },
    { id: 'l2', ownerId: 'p1', locale: 'en', slug: 'chair' },
    { id: 'l3', ownerId: 'p2', locale: 'en', slug: 'table' },
    { id: 'l4', ownerId: 'p3', locale: 'fr', slug: '' },
    { id: 'l5', ownerId: 'p3', locale: 'en', slug: 'lamp' }
  ]);
  await db.insert(tags).values([
    { id: 't1', name: 'Red' },
    { id: 't2', name: 'Blue' }
  ]);
  await db.insert(products__$relations).values([
    { id: 'r1', path: 'tags', position: 0, ownerId: 'p1', tagsId: 't1' },
    { id: 'r2', path: 'tags', position: 1, ownerId: 'p1', tagsId: 't2' },
    { id: 'r3', path: 'tags', position: 0, ownerId: 'p2', tagsId: 't1' },
    { id: 'r4', path: 'category', position: 0, ownerId: 'p1', categoriesId: 'c1' },
    { id: 'r5', path: 'category', position: 0, ownerId: 'p3', categoriesId: 'c2' }
  ]);
  await db.insert(categories).values([{ id: 'c1' }, { id: 'c2' }]);
  await db.insert(categories__versions).values([
    { id: 'cv1', ownerId: 'c1', title: 'News' },
    { id: 'cv2', ownerId: 'c1', title: 'News, renamed' },
    { id: 'cv3', ownerId: 'c2', title: 'Sport' }
  ]);
  await db.insert(products__versions).values([
    { id: 'v1', ownerId: 'p1', title: 'Chair, first' },
    { id: 'v2', ownerId: 'p1', title: 'Chair, second' },
    { id: 'v3', ownerId: 'p2', title: 'Table' }
  ]);
  await db.insert(items).values([
    { id: 'i1', code: '007', at: new Date('2024-01-01') },
    { id: 'i2', code: '', at: new Date('2024-06-15') },
    { id: 'i3', code: '7', at: null },
    { id: 'i4', code: 'release 2024-01-01', at: new Date('2025-01-01') }
  ]);
  await db.insert(items__$$locales).values([
    { id: 'il1', ownerId: 'i1', locale: 'en', label: '2024' },
    { id: 'il2', ownerId: 'i2', locale: 'en', label: 'summer' }
  ]);
});

/** The ids of the products a `where` keeps, read in `locale`. */
const idsWhere = async (where: Dic, locale?: string) =>
  (
    await db
      .select({ id: products.id })
      .from(products)
      .where(
        buildWhereParam({
          query: { where },
          slug: 'products' as never,
          locale,
          db: db as never,
          tables: tables as never,
          configCtx
        })
      )
  )
    .map((row) => row.id)
    .sort();

/** The ids of the items a `where` keeps, read in `locale`. */
const itemIdsWhere = async (where: Dic, locale?: string) =>
  (
    await db
      .select({ id: items.id })
      .from(items)
      .where(
        buildWhereParam({
          query: { where },
          slug: 'items' as never,
          locale,
          db: db as never,
          tables: tables as never,
          configCtx
        })
      )
  )
    .map((row) => row.id)
    .sort();

/** The ids of the versions a `where` keeps, the versions table standing in for `products`. */
const versionIdsWhere = async (where: Dic) =>
  (
    await db
      .select({ id: products__versions.id })
      .from(products__versions)
      .where(
        buildWhereParam({
          query: { where },
          slug: '$products__versions' as never,
          base: 'products' as never,
          db: db as never,
          tables: tables as never,
          configCtx
        })
      )
  )
    .map((row) => row.id)
    .sort();

describe('operators on a column', () => {
  test('equals, not_equals, and the lists of in_array and not_in_array', async () => {
    expect(await idsWhere({ sku: { equals: 'sku-a' } })).toEqual(['p1']);
    expect(await idsWhere({ sku: { not_equals: 'sku-a' } })).toEqual(['p2', 'p3']);
    // A list comes from a URL as one string, or from code as an array
    expect(await idsWhere({ sku: { in_array: 'sku-a,sku-c' } })).toEqual(['p1', 'p3']);
    expect(await idsWhere({ sku: { in_array: ['sku-b'] } })).toEqual(['p2']);
    expect(await idsWhere({ sku: { not_in_array: 'sku-a,sku-c' } })).toEqual(['p2']);
  });

  test('like matches anywhere in the value, unless the value holds its own %', async () => {
    expect(await idsWhere({ sku: { like: 'ku-b' } })).toEqual(['p2']);
    expect(await idsWhere({ sku: { like: 'sku-%' } })).toEqual(['p1', 'p2', 'p3']);
    expect(await idsWhere({ sku: { like: '%-c' } })).toEqual(['p3']);
    expect(await idsWhere({ sku: { not_like: 'ku-b' } })).toEqual(['p1', 'p3']);
  });

  test('ilike runs on SQLite and ignores case', async () => {
    expect(await idsWhere({ sku: { ilike: 'SKU-B' } })).toEqual(['p2']);
  });

  test('between keeps the rows inside the range, from a URL or from code', async () => {
    expect(await idsWhere({ price: { between: '1,10' } })).toEqual(['p1', 'p2']);
    expect(await idsWhere({ price: { between: [1, 10] } })).toEqual(['p1', 'p2']);
    expect(await idsWhere({ price: { not_between: '1,10' } })).toEqual(['p3']);
  });

  test('a range that is not two values is refused', async () => {
    await expect(idsWhere({ price: { between: '1' } })).rejects.toThrow('between takes two values');
  });

  test('a number sent as a string compares as a number', async () => {
    expect(await idsWhere({ price: { greater_than: '4' } })).toEqual(['p2', 'p3']);
    expect(await idsWhere({ price: { greater_than_or_equals: '5' } })).toEqual(['p2', 'p3']);
    expect(await idsWhere({ price: { less_than: '5' } })).toEqual(['p1']);
    expect(await idsWhere({ price: { less_than_or_equals: '5' } })).toEqual(['p1', 'p2']);
  });

  test('a boolean sent as a string compares as a boolean', async () => {
    expect(await idsWhere({ active: { equals: 'true' } })).toEqual(['p1', 'p3']);
    expect(await idsWhere({ active: { equals: 'false' } })).toEqual(['p2']);
  });

  test('a boolean sent as 1 or 0 compares as a boolean', async () => {
    expect(await idsWhere({ active: { equals: '1' } })).toEqual(['p1', 'p3']);
    expect(await idsWhere({ active: { equals: '0' } })).toEqual(['p2']);
    expect(await idsWhere({ active: { not_equals: '0' } })).toEqual(['p1', 'p3']);
    expect(await idsWhere({ active: { in_array: '0' } })).toEqual(['p2']);
  });

  test('and and or combine their conditions', async () => {
    expect(
      await idsWhere({ or: [{ sku: { equals: 'sku-a' } }, { price: { greater_than: '10' } }] })
    ).toEqual(['p1', 'p3']);
    expect(
      await idsWhere({ and: [{ active: { equals: 'true' } }, { price: { less_than: '10' } }] })
    ).toEqual(['p1']);
  });

  test('several fields in one object are all applied', async () => {
    expect(await idsWhere({ active: { equals: 'true' }, price: { less_than: '10' } })).toEqual([
      'p1'
    ]);
  });

  test('several operators on one field are all applied', async () => {
    expect(await idsWhere({ price: { greater_than: '4', less_than: '10' } })).toEqual(['p2']);
  });

  test('and and or beside a field are applied with it', async () => {
    expect(
      await idsWhere({
        active: { equals: 'true' },
        or: [{ sku: { equals: 'sku-a' } }, { sku: { equals: 'sku-b' } }]
      })
    ).toEqual(['p1']);
  });

  test('a field the config does not have matches nothing', async () => {
    expect(await idsWhere({ color: { equals: 'red' } })).toEqual([]);
  });

  test('an operator it does not know is refused', async () => {
    await expect(idsWhere({ sku: { near: 'sku-a' } })).rejects.toThrow('near is not supported');
  });
});

describe('a value read as the type of the column it is compared to', () => {
  test('a text column keeps the value as sent', async () => {
    expect(await itemIdsWhere({ code: { equals: '007' } })).toEqual(['i1']);
    expect(await itemIdsWhere({ code: { equals: '' } })).toEqual(['i2']);
    expect(await itemIdsWhere({ code: { like: '2024-01-01' } })).toEqual(['i4']);
  });

  test('a localized text column matches a number-like value', async () => {
    expect(await itemIdsWhere({ label: { equals: '2024' } }, 'en')).toEqual(['i1']);
  });

  test('a date column reads the string as a date, and refuses one that is not', async () => {
    expect(await itemIdsWhere({ at: { greater_than: '2024-03-01' } })).toEqual(['i2', 'i4']);
    await expect(itemIdsWhere({ at: { equals: 'soon' } })).rejects.toThrow('"soon" is not a date');
  });

  test('a like pattern is never cast', async () => {
    expect(await itemIdsWhere({ at: { like: 'ab' } })).toEqual([]);
  });

  test('a null check takes no value', async () => {
    expect(await itemIdsWhere({ at: { is_null: 'true' } })).toEqual(['i3']);
  });

  test('in_array takes a number from code', async () => {
    expect(await idsWhere({ price: { in_array: 5 } })).toEqual(['p2']);
  });
});

describe('a localized column, compared as the read shows it', () => {
  test('in the read locale first, then the default locale', async () => {
    expect(await idsWhere({ slug: { equals: 'chaise' } }, 'fr')).toEqual(['p1']);
    expect(await idsWhere({ slug: { equals: 'chair' } }, 'fr')).toEqual([]);
    expect(await idsWhere({ slug: { equals: 'chair' } }, 'en')).toEqual(['p1']);
    // p2 has no fr row, so fr shows its en slug
    expect(await idsWhere({ slug: { equals: 'table' } }, 'fr')).toEqual(['p2']);
  });

  test('an empty value counts as not written', async () => {
    expect(await idsWhere({ slug: { equals: 'lamp' } }, 'fr')).toEqual(['p3']);
  });

  test('every operator reads the same fallback', async () => {
    expect(await idsWhere({ slug: { like: 'ab' } }, 'fr')).toEqual(['p2']);
    expect(await idsWhere({ slug: { in_array: 'chaise,lamp' } }, 'fr')).toEqual(['p1', 'p3']);
    expect(await idsWhere({ slug: { in_array: 'chaise,lamp' } }, 'en')).toEqual(['p3']);
  });
});

describe('a relation with many values', () => {
  test('equals is the same set, in any order', async () => {
    expect(await idsWhere({ tags: { equals: 't1,t2' } })).toEqual(['p1']);
    expect(await idsWhere({ tags: { equals: 't2,t1' } })).toEqual(['p1']);
    expect(await idsWhere({ tags: { equals: 't1' } })).toEqual(['p2']);
  });

  test('not_equals is any other set, an empty one included', async () => {
    expect(await idsWhere({ tags: { not_equals: 't1' } })).toEqual(['p1', 'p3']);
  });

  test('in_array keeps the documents whose values are all in the list, and not an empty one', async () => {
    expect(await idsWhere({ tags: { in_array: 't1,t2' } })).toEqual(['p1', 'p2']);
    expect(await idsWhere({ tags: { in_array: 't1' } })).toEqual(['p2']);
  });

  test('not_in_array keeps the documents with a value outside the list', async () => {
    expect(await idsWhere({ tags: { not_in_array: 't1' } })).toEqual(['p1']);
  });

  test('an operator a set cannot answer matches nothing', async () => {
    expect(await idsWhere({ tags: { like: 't1' } })).toEqual([]);
  });

  test('a property of the related document', async () => {
    expect(await idsWhere({ 'tags.name': { equals: 'Red' } })).toEqual(['p1', 'p2']);
    expect(await idsWhere({ 'tags.name': { equals: 'Blue' } })).toEqual(['p1']);
  });

  test('a property of a versioned related document matches any of its versions', async () => {
    expect(await idsWhere({ 'category.title': { equals: 'Sport' } })).toEqual(['p3']);
    expect(await idsWhere({ 'category.title': { equals: 'News, renamed' } })).toEqual(['p1']);
    expect(await idsWhere({ 'category.title': { like: 'News' } })).toEqual(['p1']);
  });
});

describe('a versions table standing in for its base', () => {
  test('id is the document, and versionId the version', async () => {
    expect(await versionIdsWhere({ id: { equals: 'p1' } })).toEqual(['v1', 'v2']);
    expect(await versionIdsWhere({ versionId: { equals: 'v2' } })).toEqual(['v2']);
  });

  test('a query built twice means the same both times, and is left as it was', async () => {
    const where = { versionId: { equals: 'v2' } };
    expect(await versionIdsWhere(where)).toEqual(['v2']);
    expect(await versionIdsWhere(where)).toEqual(['v2']);
    expect(where).toEqual({ versionId: { equals: 'v2' } });
  });

  test('a column of the base row is reached through the document', async () => {
    expect(await versionIdsWhere({ sku: { equals: 'sku-b' } })).toEqual(['v3']);
  });

  test('a column of its own is read on the version', async () => {
    expect(await versionIdsWhere({ title: { like: 'Chair' } })).toEqual(['v1', 'v2']);
  });
});
