import buildRootTable from '$lib/adapter-sqlite/generate-schema/root.server.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import {
  block,
  blocks,
  group,
  relation,
  tab,
  tabs,
  text,
  toggle,
  tree
} from '$lib/fields/index.js';
import { expect, test } from 'vitest';

// Field order is column order, and nothing else catches a reorder.

const fields = [
  tabs(
    tab('hero').fields(
      text('headline'),
      group('media').fields(text('alt'), relation('image').to('medias'))
    ),
    tab('attributes').fields(
      text('title').localized(),
      toggle('isHome'),
      group('seo').fields(text('metaTitle').localized(), group('og').fields(text('ogTitle')))
    ),
    tab('layout').fields(
      blocks('components', [block('hero').fields(text('label'))]),
      tree('nav').fields(text('label'))
    )
  ),
  text('status').$root(),
  text('sku').$index(),
  text('url').localized().$index()
];

/** The column names of one table in the generated source, in order. */
const columns = (schema: string, table: string) => {
  const body = schema.split(`sqliteTable( '${table}', {`)[1].split('\n\t}')[0];
  return [...body.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
};

test('the columns a config generates, in order', async () => {
  const out = await buildRootTable({
    fields: fields as any,
    tableName: 'pages' as any,
    rootName: 'pages' as any,
    locales: [{ code: 'en', label: 'English' }] as any,
    blocksRegister: []
  });

  expect(columns(out.schema, 'pages')).toEqual([
    'id',
    'hero__headline',
    'hero__media__alt',
    'attributes__isHome',
    'attributes__seo__og__ogTitle',
    'status',
    'sku'
  ]);
  expect(columns(out.schema, 'pages__$$locales')).toEqual([
    'id',
    'attributes__title',
    'attributes__seo__metaTitle',
    'url',
    'locale',
    'ownerId'
  ]);
  expect(columns(out.schema, 'pages__$blocks_hero')).toEqual([
    'id',
    'label',
    'type',
    'path',
    'position',
    'ownerId'
  ]);
  expect(columns(out.schema, 'pages__$tree_nav')).toEqual([
    'id',
    'path',
    'position',
    'label',
    'ownerId'
  ]);

  expect(out.relationFieldsMap).toEqual({ image: { localized: false, to: 'medias' } });
  expect(out.referenceJoins).toEqual([]);
  expect(out.relationsDic).toEqual({
    pages: ['pages__$blocks_hero', 'pages__$tree_nav', 'pages__$$locales']
  });
});

test('a field with $index() and every owner_id get an index on their own table', async () => {
  const { schema } = await buildRootTable({
    fields: fields as any,
    tableName: 'pages' as any,
    rootName: 'pages' as any,
    locales: [{ code: 'en', label: 'English' }] as any,
    blocksRegister: []
  });

  expect(schema).toContain(`index('pages_sku_idx').on(t.sku)`);
  expect(schema).toContain(`index('pages__$$locales_url_idx').on(t.url)`);
  expect(schema).toContain(`index('pages__$$locales_owner_id_idx').on(t.ownerId)`);
  expect(schema).toContain(`index('pages__$blocks_hero_owner_id_idx').on(t.ownerId)`);
  expect(schema).toContain(`index('pages__$tree_nav_owner_id_idx').on(t.ownerId)`);
  // the base table's own id is not an owner: no owner_id index there
  expect(schema).not.toContain(`index('pages_owner_id_idx')`);
});

test('a relation from a second copy of its class still gets junction rows, not a column', async () => {
  // A dev reload can load RelationFieldBuilder twice. A relation built from the other copy fails
  // `instanceof RelationFieldBuilder` but passes `instanceof FormFieldBuilder`.
  const image = Object.setPrototypeOf(relation('image').to('medias'), FormFieldBuilder.prototype);
  const out = await buildRootTable({
    fields: [text('title'), image] as any,
    tableName: 'pages' as any,
    rootName: 'pages' as any,
    locales: [{ code: 'en', label: 'English' }] as any,
    blocksRegister: []
  });

  expect(columns(out.schema, 'pages')).toEqual(['id', 'title']);
  expect(out.relationFieldsMap).toEqual({ image: { localized: false, to: 'medias' } });
});
