import { getTableColumns } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, test, vi } from 'vitest';
import { transformDataToSchema } from './columns.server.js';

// An area's table: a NOT NULL column of each storage type, and a group flattened into the row
const infos = sqliteTable('infos', {
  label: text('label').notNull(),
  count: real('count').notNull(),
  rank: integer('rank').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
  data: text('data', { mode: 'json' }).notNull()
});
const columns = getTableColumns(infos);

const pages = sqliteTable('pages', {
  attributes__title: text('attributes__title'),
  attributes__seo__description: text('attributes__seo__description')
});

describe('transformDataToSchema', () => {
  test('fills every NOT NULL column the data leaves empty with a value of its type', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const row = transformDataToSchema({}, columns, { fillNotNull: true });

    expect(row).toMatchObject({ label: '', count: 0, rank: 0, active: false, data: {} });
    expect(row.publishedAt).toBeInstanceOf(Date);
  });

  test('leaves a NOT NULL column with a default of its own to that default', () => {
    // A required many select and a required date, as the schema generator writes them
    const settings = sqliteTable('settings', {
      tags: text('tags', { mode: 'json' }).notNull().default([]),
      startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull().default(new Date(0)),
      title: text('title').notNull().default('Untitled')
    });

    const row = transformDataToSchema({ tags: null }, getTableColumns(settings), {
      fillNotNull: true
    });

    expect(row).toEqual({});
  });

  test('a null group nulls every column below it', () => {
    expect(transformDataToSchema({ attributes: null }, getTableColumns(pages))).toEqual({
      attributes__title: null,
      attributes__seo__description: null
    });
  });
});
