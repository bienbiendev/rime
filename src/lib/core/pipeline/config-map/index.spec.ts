import { block, blocks, group, tab, tabs, text, toggle, tree } from '$lib/fields/index.js';
import { expect, test } from 'vitest';
import { buildConfigMap } from './index.js';

const fields = [
  tabs(
    tab('layout').fields(
      blocks('components', [
        block('paragraph').fields(text('text')),
        block('slider').fields(text('image'), group('legend').fields(text('caption')))
      ])
    ),
    tab('attributes').fields(text('title'), group('meta').fields(toggle('ok'))),
    tab('footer').fields(tree('nav').fields(text('label'), group('link').fields(text('href'))))
  )
];

const keys = (data: any) => Object.keys(buildConfigMap(data, fields)).sort();

test('a tab keys its children under its own name', () => {
  expect(keys({ attributes: { title: 'Hello', meta: { ok: true } } })).toEqual([
    'attributes.meta',
    'attributes.meta.ok',
    'attributes.title'
  ]);
});

test('a block keys at its index, with the type stripped', () => {
  const data = {
    layout: {
      components: [
        { type: 'paragraph', text: 'a' },
        { type: 'slider', image: 'b.jpg', legend: { caption: 'c' } }
      ]
    }
  };
  expect(keys(data)).toEqual([
    'layout.components',
    'layout.components.0.text',
    'layout.components.0.type',
    'layout.components.1.image',
    'layout.components.1.legend',
    'layout.components.1.legend.caption',
    'layout.components.1.type'
  ]);
});

// A tree row is keyed like any other value: the fields it holds, and the containers inside it.
// The row's declared fields it does not hold — `path`, `position` here — get no key.
test('a tree keys every row and its nesting', () => {
  const data = {
    footer: {
      nav: [{ label: 'a', link: { href: '/a' }, _children: [{ label: 'b' }] }, { label: 'c' }]
    }
  };
  expect(keys(data)).toEqual([
    'footer.nav',
    'footer.nav.0._children.0.label',
    'footer.nav.0.label',
    'footer.nav.0.link',
    'footer.nav.0.link.href',
    'footer.nav.1.label'
  ]);
});

test('residual data for a block type the config dropped is skipped', () => {
  const data = { layout: { components: [{ type: 'gone', text: 'a' }] } };
  expect(keys(data)).toEqual(['layout.components']);
});
