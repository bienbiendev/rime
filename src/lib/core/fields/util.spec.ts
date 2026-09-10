// @ts-nocheck
import {
  block,
  blocks,
  date,
  group,
  link,
  radio,
  relation,
  richText,
  slug,
  tab,
  tabs,
  text,
  toggle,
  tree
} from '$lib/fields/index.js';
import { bold } from '$lib/fields/rich-text/client.js';
import { normalizeFieldPath } from '$lib/util/path.js';
import { Images, Text } from '@lucide/svelte';
import { expect, test } from 'vitest';
import { FormFieldBuilder } from './builders/form-field-builder.js';
import { getFieldAtPath, getFieldListAtPath, isFormField } from './util.js';

// getFieldAtPath operates on FieldBuilder[], like getFieldListAtPath. Kept separate from the
// `builders` tree below (used by the getFieldListAtPath tests) because that one's field counts
// are asserted exactly and do not include this fixture's group-inside-attributes and
// tree-inside-slider-block.
const configByPathFields = [
  tabs(
    tab('hero').fields(
      radio('heroType').options('banner', 'text').defaultValue('banner'),
      relation('image').to('medias'),
      richText('intro')
    ),
    tab('layout').fields(
      blocks('components', [
        block('paragraph')
          .description('Simple paragraph')
          .fields(richText('text').localized(), text('type').hidden()),
        block('slider')
          .description('Simple slider')
          .fields(text('image'), text('type').hidden(), tree('legends').fields(text('legend')))
      ]).table()
    ),
    tab('attributes').fields(
      text('title').isTitle().localized().required(),
      group('group').fields(relation('image').to('medias'), toggle('ok'))
    ),
    tab('footer').fields(
      tree('nav').fields(text('label'), link('link'), group('group').fields(text('metaTitle')))
    )
  ),
  text('status').defaultValue('draft').hidden(),
  text('editedBy').hidden(),
  date('createdAt').hidden(),
  date('updatedAt').hidden()
];

test('should return bar.0.foo', () => {
  const res = normalizeFieldPath('bar.0:booz.foo');
  expect(res).toBe('bar.0.foo');
});

test('should return bar.0.foo.4.baz', () => {
  const res = normalizeFieldPath('bar.0:hello.foo.4:guys.baz');
  expect(res).toBe('bar.0.foo.4.baz');
});

test('should return bar.0.foo.4.baz', () => {
  const res = normalizeFieldPath('bar.0.foo.4.baz');
  expect(res).toBe('bar.0.foo.4.baz');
});

test('should return bar.0.Foo12.4.baz', () => {
  const res = normalizeFieldPath('bar.0:3someCase.Foo12.4.baz');
  expect(res).toBe('bar.0.Foo12.4.baz');
});

test('should return correct config', () => {
  const field = getFieldAtPath('hero.heroType', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('heroType');
});

test('should return correct block field config', () => {
  const field = getFieldAtPath('layout.components.0:paragraph.text', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('text');
  expect(field?.type).toBe('richText');
});

test('should return correct title field config', () => {
  const field = getFieldAtPath('attributes.title', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('title');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside group', () => {
  const field = getFieldAtPath('attributes.group.ok', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('ok');
  expect(field?.type).toBe('toggle');
});

test('should return correct field config inside tree', () => {
  const field = getFieldAtPath('footer.nav.0.label', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('label');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside tree 2', () => {
  const field = getFieldAtPath('footer.nav.0.link', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('link');
  expect(field?.type).toBe('link');
});

test('should return correct field config inside tree inside group', () => {
  const field = getFieldAtPath('footer.nav.0.group.metaTitle', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('metaTitle');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside blocks inside tree', () => {
  const field = getFieldAtPath('layout.components.0:slider.legends.0.legend', configByPathFields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('legend');
  expect(field?.type).toBe('text');
});

test('should not return field config inside blocks without param inBlockType', () => {
  const field = getFieldAtPath('layout.components.0.legends.0.legend', configByPathFields);
  expect(field).toBe(undefined);
});

// Builders for testing getFieldListAtPath

const blockParagraph = block('paragraph')
  .icon(Text)
  .description('Simple paragraph')
  .fields(richText('text').localized());

const blockSlider = block('slider').icon(Images).description('Simple slider').fields(text('image'));
const blockImage = block('image').fields(relation('image').to('medias'), text('legend'));

const tabHero = tab('hero').fields(
  radio('heroType').options('banner', 'text').defaultValue('banner'),
  relation('image')
    .to('medias')
    .condition((doc) => {
      return doc.heroType === 'banner';
    }),
  richText('intro').features(bold())
);

const tabAttributes = tab('attributes').fields(
  text('title').isTitle().localized().required(),
  toggle('isHome').table({ position: 2, sort: true }).live(false),
  slug('slug')
    .slugify('attributes.title')
    .live(false)
    .table({ position: 3, sort: true })
    .localized()
    .required(),

  relation('related').to('pages').many(),
  relation('author').to('staff'),
  relation('contributors').to('staff').many(),
  relation('ambassadors').to('staff').many().localized(),
  date('published')
);

const tabContent = tab('layout').fields(
  blocks('components', [blockParagraph, blockSlider, blockImage]).table().localized()
);

const tabSeo = tab('seo').fields(
  text('metaTitle').localized(),
  text('metaDescription').localized()
);

const tabFooter = tab('footer').fields(
  tree('nav').fields(text('label'), text('link'), group('group').fields(text('metaTitle')))
);

const builders = tabs(tabHero, tabContent, tabAttributes, tabSeo, tabFooter);

test('should return correct field builders at path inside blocks', () => {
  const { fields: fieldList, path } = getFieldListAtPath('layout.components.0:slider.image', [
    builders
  ]);
  const builder = fieldList[0];
  if (!(builder instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(1);
  expect(builder.field.name).toBeDefined();
  expect(builder.field.name).toBe('image');
  expect(path).toBe('layout.components.0');
});

test('should return the list of fields inside a block', () => {
  const { fields: fieldList, path } = getFieldListAtPath('layout.components.0:slider', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(5); // [ 'image', 'type', 'path', 'position', 'locale' ]
  const builder = fieldList[0];
  if (!(builder instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder.field.name).toBeDefined();
  expect(builder.field.name).toBe('image');
  expect(path).toBe('layout.components.0');
});

test('should return the list of fields inside a tab', () => {
  const { fields: fieldList, path } = getFieldListAtPath('hero', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(3);
  const builder1 = fieldList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('heroType');
  expect(path).toBe('hero');
  const builder2 = fieldList[1];
  if (!(builder2 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder2.field.name).toBeDefined();
  expect(builder2.field.name).toBe('image');
  const builder3 = fieldList[2];
  if (!(builder3 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder3.field.name).toBeDefined();
  expect(builder3.field.name).toBe('intro');
});

test('should return the list of fields inside a tree', () => {
  const { fields: fieldList, path } = getFieldListAtPath('footer.nav', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(5); // [ 'path', 'position', 'label', 'link', 'group' ]
  const filteredList = fieldList.filter(
    (builder) => isFormField(builder) && builder.get.hidden !== true
  );
  const builder1 = filteredList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('label');
  expect(path).toBe('footer.nav');
  const builder2 = filteredList[1];
  if (!(builder2 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder2.field.name).toBeDefined();
  expect(builder2.field.name).toBe('link');
  const builder3 = filteredList[2];
  if (!(builder3 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder3.field.name).toBeDefined();
  expect(builder3.field.name).toBe('group');
});

// const tabFooter = tab('footer').fields(
//   tree('nav').fields(
//     //
//     text('label'),
//     text('link'),
//     tree('group').fields(text('metaTitle'))
//   )
// );

test('should return the list of fields inside a group inside a tree', () => {
  const { fields: fieldList, path } = getFieldListAtPath('footer.nav.0.group', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(1);
  const builder1 = fieldList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('metaTitle');
  expect(path).toBe('footer.nav.0.group');
});

test('should return one field inside a tree', () => {
  const { fields: fieldList, path } = getFieldListAtPath('footer.nav.0.label', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(1);
  const builder1 = fieldList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('label');
  expect(path).toBe('footer.nav.0');
});

test('should return one field inside a tab', () => {
  const { fields: fieldList, path } = getFieldListAtPath('hero.heroType', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(1);
  const builder1 = fieldList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('heroType');
  expect(path).toBe('hero');
});
