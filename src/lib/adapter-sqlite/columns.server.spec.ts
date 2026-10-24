import { getTableColumns } from 'drizzle-orm';
import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, test } from 'vitest';
import { transformDataToSchema } from './columns.server.js';

// A table with a group flattened into the row
const pages = sqliteTable('pages', {
  price: real('price'),
  attributes__title: text('attributes__title'),
  attributes__seo__description: text('attributes__seo__description')
});
const columns = getTableColumns(pages);

describe('transformDataToSchema', () => {
  test('leaves out a column the data does not hold, and makes up no value for it', () => {
    expect(transformDataToSchema({ attributes: { title: 'Home' } }, columns)).toEqual({
      attributes__title: 'Home'
    });
  });

  test('keeps a null and a falsy value', () => {
    expect(transformDataToSchema({ price: 0, attributes: { title: null } }, columns)).toEqual({
      price: 0,
      attributes__title: null
    });
  });

  test('a null group nulls every column below it', () => {
    expect(transformDataToSchema({ attributes: null }, columns)).toEqual({
      attributes__title: null,
      attributes__seo__description: null
    });
  });
});
