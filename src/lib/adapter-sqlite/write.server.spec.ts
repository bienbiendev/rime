import { createClient } from '@libsql/client';
import { defineRelations, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { upsertLocalizedData } from './columns.server.js';
import type { TableName } from './naming.server.js';
import { createRepeatable, updateRepeatable } from './repeatable.server.js';
import { insertPrototype, updatePrototype, updateWherePrototype } from './write.server.js';

/*
 * A row's `id`, `ownerId` and `locale` say where it sits. The adapter sets them; a document's
 * data, whatever keys it carries, never moves a row.
 */

const pk = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const stamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
};

// `pages`: a localized title. `news`: its content on a versions table. A localized block list.
const pages = sqliteTable('pages', { id: pk(), slug: text('slug'), ...stamps });
const pagesLocales = sqliteTable('pages__$$locales', {
  id: pk(),
  title: text('title'),
  locale: text('locale'),
  ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' })
});
const news = sqliteTable('news', { id: pk(), ...stamps });
const newsVersions = sqliteTable('news__versions', {
  id: pk(),
  title: text('title'),
  ...stamps,
  ownerId: text('owner_id').references(() => news.id, { onDelete: 'cascade' })
});
const paragraphs = sqliteTable('pages__$blocks_paragraph', {
  id: pk(),
  type: text('type'),
  path: text('path'),
  position: real('position'),
  locale: text('locale'),
  ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' })
});
const paragraphsLocales = sqliteTable('pages__$blocks_paragraph__$$locales', {
  id: pk(),
  text: text('text'),
  locale: text('locale'),
  ownerId: text('owner_id').references(() => paragraphs.id, { onDelete: 'cascade' })
});

// A localized block list whose block has no content: no locales branch
const dividers = sqliteTable('pages__$blocks_divider', {
  id: pk(),
  type: text('type'),
  path: text('path'),
  position: real('position'),
  locale: text('locale'),
  ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' })
});

const tables = {
  pages,
  pages__$$locales: pagesLocales,
  news,
  news__versions: newsVersions,
  pages__$blocks_paragraph: paragraphs,
  pages__$blocks_paragraph__$$locales: paragraphsLocales,
  pages__$blocks_divider: dividers
};

const MIGRATION = [
  'PRAGMA foreign_keys = ON',
  'CREATE TABLE `pages` (`id` text PRIMARY KEY, `slug` text, `created_at` integer, `updated_at` integer)',
  `CREATE TABLE \`pages__$$locales\` (
    \`id\` text PRIMARY KEY, \`title\` text, \`locale\` text, \`owner_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE
  )`,
  'CREATE TABLE `news` (`id` text PRIMARY KEY, `created_at` integer, `updated_at` integer)',
  `CREATE TABLE \`news__versions\` (
    \`id\` text PRIMARY KEY, \`title\` text, \`created_at\` integer, \`updated_at\` integer, \`owner_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`news\`(\`id\`) ON DELETE CASCADE
  )`,
  `CREATE TABLE \`pages__$blocks_paragraph\` (
    \`id\` text PRIMARY KEY, \`type\` text, \`path\` text, \`position\` real, \`locale\` text, \`owner_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE
  )`,
  `CREATE TABLE \`pages__$blocks_paragraph__$$locales\` (
    \`id\` text PRIMARY KEY, \`text\` text, \`locale\` text, \`owner_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages__$blocks_paragraph\`(\`id\`) ON DELETE CASCADE
  )`,
  `CREATE TABLE \`pages__$blocks_divider\` (
    \`id\` text PRIMARY KEY, \`type\` text, \`path\` text, \`position\` real, \`locale\` text, \`owner_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE
  )`
];

const versions = { slug: '$news__versions' };

let db: any;
let deps: { db: any; tables: any };

beforeEach(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-write-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  db = drizzle({ client, relations: defineRelations(tables) });
  deps = { db, tables };
  await db.insert(pages).values([{ id: 'A' }, { id: 'B' }]);
  await db.insert(news).values([{ id: 'A' }, { id: 'B' }]);
  await db.insert(newsVersions).values([{ id: 'vA', ownerId: 'A', title: 'A' }]);
});

const titles = async () =>
  (await db.select().from(pagesLocales)).map(({ ownerId, locale, title }: any) => ({
    ownerId,
    locale,
    title
  }));

describe('upsertLocalizedData', () => {
  test('a locales row keeps the owner and locale it was addressed by', async () => {
    const address = { ownerId: 'A', locale: 'fr' };
    await upsertLocalizedData(db, tables, 'pages__$$locales', {
      ...address,
      data: { title: 'Bonjour' }
    });
    await upsertLocalizedData(db, tables, 'pages__$$locales', {
      ...address,
      data: { id: 'A', ownerId: 'B', locale: 'en', title: 'Salut' }
    });

    expect(await titles()).toEqual([{ ownerId: 'A', locale: 'fr', title: 'Salut' }]);
  });

  test('a new locales row takes a fresh id, whatever id the data carries', async () => {
    for (const locale of ['fr', 'de']) {
      await upsertLocalizedData(db, tables, 'pages__$$locales', {
        ownerId: 'A',
        locale,
        data: { id: 'A', title: locale }
      });
    }

    expect(await titles()).toEqual([
      { ownerId: 'A', locale: 'fr', title: 'fr' },
      { ownerId: 'A', locale: 'de', title: 'de' }
    ]);
  });
});

describe('updatePrototype', () => {
  test('an id in the data does not rewrite the row key', async () => {
    await updatePrototype(deps, { slug: 'pages', id: 'A', data: { id: 'Z', slug: 'a' } });

    expect(await db.select({ id: pages.id, slug: pages.slug }).from(pages)).toEqual([
      { id: 'A', slug: 'a' },
      { id: 'B', slug: null }
    ]);
  });

  test('answers the id of the row it wrote, not an id in the data', async () => {
    expect(await updatePrototype(deps, { slug: 'pages', id: 'A', data: { id: 'B' } })).toEqual({
      id: 'A'
    });
  });

  test('an id or ownerId in the content does not move the version row', async () => {
    await updatePrototype(deps, {
      slug: 'news',
      versions,
      id: 'A',
      data: {},
      content: { id: 'vA', data: { id: 'X', ownerId: 'B', title: 'x' } }
    });

    expect(
      await db
        .select({ id: newsVersions.id, ownerId: newsVersions.ownerId, title: newsVersions.title })
        .from(newsVersions)
    ).toEqual([{ id: 'vA', ownerId: 'A', title: 'x' }]);
  });

  test('every locale gets its own row when the data carries the document', async () => {
    const doc = { id: 'A', locale: 'en' };
    for (const [locale, title] of [
      ['en', 'Hello'],
      ['fr', 'Bonjour'],
      ['de', 'Hallo']
    ]) {
      await updatePrototype(deps, { slug: 'pages', id: 'A', data: { ...doc, title }, locale });
    }

    expect(await titles()).toEqual([
      { ownerId: 'A', locale: 'en', title: 'Hello' },
      { ownerId: 'A', locale: 'fr', title: 'Bonjour' },
      { ownerId: 'A', locale: 'de', title: 'Hallo' }
    ]);
  });
});

describe('updateWherePrototype', () => {
  // French alone: a localized column is read in the locale written
  const configCtx = {
    getBySlug: (slug: string) => ({ slug, fields: [] }),
    raw: { localization: { locales: [{ code: 'fr' }], default: 'fr' } },
    getLocalesCodes: () => ['fr']
  } as never;
  const slugs = async () =>
    (await db.select().from(pages)).map(({ id, slug }: any) => ({ id, slug }));

  test('a filter on a localized column reads it in the locale written', async () => {
    await db.insert(pagesLocales).values([
      { ownerId: 'A', locale: 'fr', title: 'Bonjour' },
      { ownerId: 'B', locale: 'fr', title: 'Salut' }
    ]);

    await updateWherePrototype(
      { ...deps, configCtx },
      {
        slug: 'pages' as never,
        query: { where: { title: { equals: 'Bonjour' } } },
        data: { slug: 'home' },
        locale: 'fr'
      }
    );

    expect(await slugs()).toEqual([
      { id: 'A', slug: 'home' },
      { id: 'B', slug: null }
    ]);
  });

  test('a filter that keeps every row is refused, and nothing is written', async () => {
    await expect(
      updateWherePrototype(
        { ...deps, configCtx },
        { slug: 'pages' as never, query: { where: { and: [] } }, data: { slug: 'all' } }
      )
    ).rejects.toThrow('refusing to update every row of "pages"');

    expect(await slugs()).toEqual([
      { id: 'A', slug: null },
      { id: 'B', slug: null }
    ]);
  });
});

describe('insertPrototype', () => {
  test('the first version hangs off the new document, whatever its content says', async () => {
    const { id, contentId } = await insertPrototype(deps, {
      slug: 'news',
      versions,
      data: {},
      content: { data: { id: 'X', ownerId: 'B', title: 'new' } }
    });

    const [row] = await db.select().from(newsVersions).where(eq(newsVersions.title, 'new'));
    expect(row).toMatchObject({ id: contentId, ownerId: id });
    expect(contentId).not.toBe('X');
  });

  test('the locales row of a new document takes a fresh id', async () => {
    await insertPrototype(deps, { slug: 'pages', data: { id: 'P', title: 'Hello' }, locale: 'en' });

    const [row] = await db.select().from(pagesLocales);
    expect(row).toMatchObject({ ownerId: 'P', locale: 'en', title: 'Hello' });
    expect(row.id).not.toBe('P');
  });
});

describe('updateRepeatable', () => {
  const table = 'pages__$blocks_paragraph' as TableName;

  test('a saved block keeps its owner and locale', async () => {
    await createRepeatable(
      deps,
      table,
      { type: 'paragraph', path: 'body', position: 0 },
      'A',
      'en'
    );
    const [{ id }] = await db.select().from(paragraphs);

    await updateRepeatable(
      deps,
      table,
      { id, ownerId: 'B', locale: 'fr', type: 'paragraph', path: 'body', position: 1, text: 'Hi' },
      'en'
    );

    expect(await db.select().from(paragraphs)).toMatchObject([
      { id, ownerId: 'A', locale: 'en', position: 1 }
    ]);
    expect(await db.select().from(paragraphsLocales)).toMatchObject([
      { ownerId: id, locale: 'en', text: 'Hi' }
    ]);
  });
});

describe('createRepeatable', () => {
  test('a new block of a table with no locales branch takes the locale it is written in', async () => {
    const table = 'pages__$blocks_divider' as TableName;
    const row = { id: 'X', ownerId: 'B', locale: 'fr', type: 'divider', path: 'body', position: 0 };

    await createRepeatable(deps, table, row, 'A', 'en');

    const [created] = await db.select().from(dividers);
    expect(created).toMatchObject({ ownerId: 'A', locale: 'en', type: 'divider' });
    expect(created.id).not.toBe('X');
  });
});
