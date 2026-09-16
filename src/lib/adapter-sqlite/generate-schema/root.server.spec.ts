import buildRootTable from '$lib/adapter-sqlite/generate-schema/root.server.js';
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
  text('status').$root()
];

test('the columns a config generates, in order', async () => {
  const out = await buildRootTable({
    fields: fields as any,
    tableName: 'pages' as any,
    rootName: 'pages' as any,
    locales: [{ code: 'en', label: 'English' }] as any,
    blocksRegister: []
  });
  expect(out.schema).toMatchSnapshot();
  expect(out.relationFieldsMap).toMatchSnapshot();
  expect(out.referenceJoins).toMatchSnapshot();
  expect(out.relationsDic).toMatchSnapshot();
});
