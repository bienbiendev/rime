import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { check, foreignKey, index, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import createPathsHandle from './paths.server.js';

// The table as `templatePathsTable` writes it, and its migration as drizzle-kit generates it.
const pages = sqliteTable('pages', { id: text('id').primaryKey() });
const paths = sqliteTable(
  'pages__$paths',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    slug: text('slug').notNull(),
    parentPath: text('parent_path'),
    path: text('path').generatedAlwaysAs(sql`coalesce(parent_path || '/', '') || slug`, {
      mode: 'stored'
    }),
    url: text('url')
  },
  (t) => [
    unique('pages__$paths_owner_locale').on(t.ownerId, t.locale),
    unique('pages__$paths_path').on(t.locale, t.path),
    index('pages__$paths_parent_idx').on(t.locale, t.parentPath),
    check('pages__$paths_slug', sql`slug <> ''`),
    foreignKey({ columns: [t.locale, t.parentPath], foreignColumns: [t.locale, t.path] }).onUpdate(
      'cascade'
    )
  ]
);

const MIGRATION = [
  'CREATE TABLE `pages` (`id` text PRIMARY KEY)',
  `CREATE TABLE \`pages__$paths\` (
    \`id\` text PRIMARY KEY,
    \`owner_id\` text NOT NULL,
    \`locale\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`parent_path\` text,
    \`path\` text GENERATED ALWAYS AS (coalesce(parent_path || '/', '') || slug) STORED,
    \`url\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`locale\`,\`parent_path\`) REFERENCES \`pages__$paths\`(\`locale\`,\`path\`) ON UPDATE CASCADE,
    UNIQUE(\`owner_id\`,\`locale\`),
    UNIQUE(\`locale\`,\`path\`),
    CHECK(slug <> '')
  )`,
  'CREATE INDEX `pages__$paths_parent_idx` ON `pages__$paths` (`locale`,`parent_path`)'
];

let handle: ReturnType<typeof createPathsHandle>;
let db: ReturnType<typeof drizzle>;
const slug = 'pages' as any;

/** services > web > audits, and news at the top, in fr and en. */
const seed = async () => {
  await db.insert(pages).values(['services', 'web', 'audits', 'news'].map((id) => ({ id })));
  const both = (base: string) => [
    { locale: 'fr', slug: `${base}-fr` },
    { locale: 'en', slug: `${base}-en` }
  ];
  await handle.insert({ slug, ownerId: 'services', parentId: null, rows: both('services') });
  await handle.insert({ slug, ownerId: 'web', parentId: 'services', rows: both('web') });
  await handle.insert({ slug, ownerId: 'audits', parentId: 'web', rows: both('audits') });
  await handle.insert({ slug, ownerId: 'news', parentId: null, rows: both('news') });
};

const pathOf = async (ownerId: string, locale: string) =>
  (await handle.get({ slug, ownerId, locale }))[0]?.path;

// A file, not `:memory:`: a libsql transaction opens a connection of its own, which would see an
// empty in-memory database.
beforeEach(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-paths-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  db = drizzle({ client });
  handle = createPathsHandle({ db: db as any, tables: { pages, pages__$paths: paths } as any });
  await seed();
});

test('a page is inserted under its parent, in each locale', async () => {
  expect(await pathOf('audits', 'fr')).toBe('services-fr/web-fr/audits-fr');
  expect(await pathOf('audits', 'en')).toBe('services-en/web-en/audits-en');
});

test('a new slug carries down the subtree, in its locale only', async () => {
  const row = await handle.setSlug({ slug, ownerId: 'services', locale: 'fr', value: 'offre' });
  expect(row?.path).toBe('offre');
  expect(await pathOf('audits', 'fr')).toBe('offre/web-fr/audits-fr');
  expect(await pathOf('audits', 'en')).toBe('services-en/web-en/audits-en');
});

test('a move carries the page and its subtree, in every locale at once', async () => {
  const moved = await handle.moveUnder({ slug, ownerId: 'web', parentId: 'news' });
  expect(moved.map((row) => row.path).sort()).toEqual(['news-en/web-en', 'news-fr/web-fr']);
  expect(await pathOf('audits', 'fr')).toBe('news-fr/web-fr/audits-fr');
  expect(await pathOf('audits', 'en')).toBe('news-en/web-en/audits-en');

  await handle.moveUnder({ slug, ownerId: 'web', parentId: null });
  expect(await pathOf('audits', 'fr')).toBe('web-fr/audits-fr');
});

test('detaching the children before a delete puts them at the top, their subtrees with them', async () => {
  const detached = await handle.detachChildren({ slug, ownerId: 'services' });
  expect(detached.map((row) => row.path).sort()).toEqual(['web-en', 'web-fr']);
  await db.delete(pages).where(sql`id = 'services'`);
  expect(await handle.get({ slug, ownerId: 'services' })).toEqual([]);
  expect(await pathOf('audits', 'fr')).toBe('web-fr/audits-fr');
});

test('under answers a row and everything below it, and nothing that only shares a prefix', async () => {
  await db.insert(pages).values({ id: 'services2' });
  await handle.insert({
    slug,
    ownerId: 'services2',
    parentId: null,
    rows: [{ locale: 'fr', slug: 'services-fr-bis' }]
  });
  const rows = await handle.under({ slug, locale: 'fr', path: 'services-fr' });
  expect(rows.map((row) => row.ownerId).sort()).toEqual(['audits', 'services', 'web']);
  const alone = await handle.under({
    slug,
    locale: 'fr',
    path: 'services-fr',
    withDescendants: false
  });
  expect(alone.map((row) => row.ownerId)).toEqual(['services']);
});

test('sibling slugs, missing owners, and urls written in one go', async () => {
  expect(await handle.siblingSlugs({ slug, locale: 'fr', parentId: null })).toEqual(
    expect.arrayContaining(['services-fr', 'news-fr'])
  );
  expect(await handle.siblingSlugs({ slug, locale: 'fr', parentId: 'services' })).toEqual([
    'web-fr'
  ]);

  await db.insert(pages).values({ id: 'orphan' });
  expect(await handle.missingOwners({ slug, locale: 'fr' })).toEqual(['orphan']);

  await handle.setUrls({ slug, rows: [{ ownerId: 'web', locale: 'fr', url: 'https://a.test/x' }] });
  expect((await handle.get({ slug, ownerId: 'web', locale: 'fr' }))[0].url).toBe(
    'https://a.test/x'
  );
});

test('an empty slug and a taken address are refused', async () => {
  await expect(
    handle.setSlug({ slug, ownerId: 'news', locale: 'fr', value: '' })
  ).rejects.toThrow();
  await expect(
    handle.setSlug({ slug, ownerId: 'news', locale: 'fr', value: 'services-fr' })
  ).rejects.toThrow();
});
