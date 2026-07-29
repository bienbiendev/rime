import {
  block,
  blocks,
  date,
  group,
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
import { normalizeFieldPath } from '$lib/util/doc.js';
import { Images, Text } from '@lucide/svelte';
import { expect, test } from 'vitest';
import { FormFieldBuilder } from './builders/form-field-builder.js';
import { getFieldBuildersAtPath, getFieldConfigByPath, isFormField } from './util.js';
const fields = [
  {
    type: 'tabs',
    live: true,
    tabs: [
      {
        name: 'hero',
        label: 'hero',
        fields: [
          {
            type: 'radio',
            live: true,
            name: 'heroType',
            defaultValue: 'banner',
            options: [
              { label: 'Banner', value: 'banner' },
              { label: 'Text', value: 'text' }
            ]
          },
          {
            type: 'relation',
            live: true,
            name: 'image',
            defaultValue: [],
            hooks: {},
            relationTo: 'medias'
          },
          {
            type: 'richText',
            live: true,
            name: 'intro',
            defaultValue: null,
            marks: ['bold'],
            nodes: [],
            hooks: {}
          }
        ]
      },
      {
        name: 'layout',
        label: 'layout',
        fields: [
          {
            type: 'blocks',
            live: true,
            name: 'components',
            defaultValue: [],
            blocks: [
              {
                name: 'paragraph',
                fields: [
                  {
                    type: 'richText',
                    live: true,
                    name: 'text',
                    defaultValue: null,
                    marks: ['bold', 'italic', 'strike', 'underline'],
                    nodes: ['p', 'h2', 'h3', 'ol', 'ul', 'blockquote', 'a'],
                    hooks: {},
                    localized: true
                  },
                  {
                    type: 'text',
                    live: true,
                    name: 'type',
                    defaultValue: null,
                    hidden: true,
                    placeholder: 'Type'
                  }
                ],
                description: 'Simple paragraph'
              },
              {
                name: 'slider',
                fields: [
                  {
                    type: 'text',
                    live: true,
                    name: 'image',
                    defaultValue: null,
                    placeholder: 'Image'
                  },
                  {
                    type: 'text',
                    live: true,
                    name: 'type',
                    defaultValue: null,
                    hidden: true,
                    placeholder: 'Type'
                  },
                  {
                    type: 'tree',
                    name: 'legends',
                    fields: [{ type: 'text', name: 'legend' }]
                  }
                ],
                description: 'Simple slider'
              }
            ],
            table: { position: 99 }
          }
        ]
      },
      {
        name: 'attributes',
        label: 'attributes',
        fields: [
          {
            type: 'text',
            live: true,
            name: 'title',
            defaultValue: null,
            isTitle: true,
            localized: true,
            required: true,
            placeholder: 'Title'
          },
          {
            type: 'group',
            name: 'group',
            fields: [
              { type: 'relation', name: 'image', relationTo: 'medias' },
              { type: 'toggle', name: 'ok' }
            ]
          }
        ]
      },
      {
        name: 'footer',
        label: 'footer',
        fields: [
          {
            type: 'tree',
            name: 'nav',
            fields: [
              { name: 'label', type: 'text' },
              { name: 'link', type: 'link' },
              { name: 'group', type: 'group', fields: [{ name: 'metaTitle', type: 'text' }] }
            ]
          }
        ]
      }
    ]
  },
  {
    type: 'text',
    live: true,
    name: 'status',
    defaultValue: 'draft',
    hidden: true,
    placeholder: 'Status'
  },
  {
    type: 'text',
    live: true,
    name: 'editedBy',
    defaultValue: null,
    hidden: true,
    placeholder: 'EditedBy'
  },
  {
    type: 'date',
    live: true,
    name: 'createdAt',
    hooks: {},
    hidden: true
  },
  {
    type: 'date',
    live: true,
    name: 'updatedAt',
    hooks: {},
    hidden: true
  }
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
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('hero.heroType', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('heroType');
});

test('should return correct block field config', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('layout.components.0:paragraph.text', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('text');
  expect(field?.type).toBe('richText');
});

test('should return correct title field config', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('attributes.title', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('title');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside group', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('attributes.group.ok', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('ok');
  expect(field?.type).toBe('toggle');
});

test('should return correct field config inside tree', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('footer.nav.0.label', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('label');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside tree 2', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('footer.nav.0.link', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('link');
  expect(field?.type).toBe('link');
});

test('should return correct field config inside tree inside group', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('footer.nav.0.group.metaTitle', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('metaTitle');
  expect(field?.type).toBe('text');
});

test('should return correct field config inside blocks inside tree', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('layout.components.0:slider.legends.0.legend', fields);
  expect(field).toBeDefined();
  expect(field?.name).toBeDefined();
  expect(field?.name).toBe('legend');
  expect(field?.type).toBe('text');
});

test('should not return field config inside blocks without param inBlockType', () => {
  //@ts-expect-error no need for field.access prop for testing this
  const field = getFieldConfigByPath('layout.components.0.legends.0.legend', fields);
  expect(field).toBe(undefined);
});

// Builders for testing getFieldBuildersAtPath

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
  const { fields: fieldList, path } = getFieldBuildersAtPath('layout.components.0:slider.image', [
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('layout.components.0:slider', [
    builders
  ]);
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('hero', [builders]);
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('footer.nav', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(5); // [ 'path', 'position', 'label', 'link', 'group' ]
  const filteredList = fieldList.filter(
    (builder) => isFormField(builder.raw) && builder.raw.hidden !== true
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('footer.nav.0.group', [builders]);
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('footer.nav.0.label', [builders]);
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
  const { fields: fieldList, path } = getFieldBuildersAtPath('hero.heroType', [builders]);
  expect(fieldList).toBeDefined();
  expect(fieldList.length).toBe(1);
  const builder1 = fieldList[0];
  if (!(builder1 instanceof FormFieldBuilder))
    throw Error('Expected builder to be an instance of FormFieldBuilder');
  expect(builder1.field.name).toBeDefined();
  expect(builder1.field.name).toBe('heroType');
  expect(path).toBe('hero');
});
