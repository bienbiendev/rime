import { block, blocks, group, tab, tabs, text, toggle, tree } from '#lib/fields/index.js';
import { expect, test } from 'vitest';
import type { FieldBuilder } from './builders/field-builder.js';
import { isFormField } from './util.js';
import { matchesSegment, walkFields, walkValues } from './walk.js';

const fields = [
  tabs(
    tab('layout').fields(
      blocks('components', [
        block('paragraph').fields(text('text')),
        block('slider').fields(text('image'))
      ])
    ),
    tab('attributes').fields(text('title'), group('group').fields(toggle('ok'))),
    tab('footer').fields(
      tree('nav').fields(text('label'), group('group').fields(text('metaTitle')))
    )
  )
];

const paths = (visits: Iterable<{ path: string }>) => [...visits].map((visit) => visit.path);

test('a group contributes no segment of its own, and no storage', () => {
  const field = group('attributes').fields(text('title'));
  expect(field.use.nodes()).toEqual([{ segment: '', fields: field.get.fields }]);
  expect(field.use.nodesFor({ title: 'hello' })).toEqual([
    { segment: '', fields: field.get.fields, value: { title: 'hello' } }
  ]);
});

test('each tab is a segment, and only the tabs the value holds', () => {
  const field = tabs(tab('meta').fields(text('title')), tab('seo').fields(text('description')));
  expect(field.use.nodes().map((node) => node.segment)).toEqual(['meta', 'seo']);
  expect(field.use.nodesFor({ meta: { title: 'a' } }).map((node) => node.segment)).toEqual([
    'meta'
  ]);
});

test('blocks declare a # index and name the real one', () => {
  const field = blocks('layout', [block('hero').fields(text('title')), block('cta')]);
  expect(field.use.nodes().map((node) => node.segment)).toEqual(['#:hero', '#:cta']);
  expect(field.use.nodes().map((node) => node.storage)).toEqual([
    { kind: 'blocks', name: 'hero' },
    { kind: 'blocks', name: 'cta' }
  ]);
  expect(
    field.use
      .nodesFor([{ type: 'cta' }, { type: 'gone' }, { type: 'hero' }])
      .map((node) => node.segment)
  ).toEqual(['0:cta', '2:hero']);
});

test('a tree is one repeating branch, flattened by the value', () => {
  const field = tree('nav').fields(text('label'));
  expect(field.use.nodes()).toEqual([
    {
      segment: '#',
      repeatVia: '_children',
      fields: field.get.fields,
      storage: { kind: 'tree', name: 'nav' }
    }
  ]);
  const value = [{ label: 'a', _children: [{ label: 'b' }] }, { label: 'c' }];
  expect(field.use.nodesFor(value).map((node) => node.segment)).toEqual([
    '0',
    '0._children.0',
    '1'
  ]);
});

test('a leaf has no branches', () => {
  expect(text('title').use.nodes()).toEqual([]);
  expect(text('title').use.nodesFor('hello')).toEqual([]);
});

/**
 * The visits of the fields the config declares: the members rime adds to a block or a tree row
 * are hidden.
 */
const declared = (visits: Iterable<{ field: FieldBuilder; path: string }>) =>
  [...visits].filter(({ field }) => !(isFormField(field) && field.get.hidden));

// A `tabs` field has no name, so it sits at its parent's own path and each tab names the segment.
test('walkFields reaches every block type and the tree row', () => {
  expect(paths(declared(walkFields(fields)))).toEqual([
    '',
    'layout.components',
    'layout.components.#:paragraph.text',
    'layout.components.#:slider.image',
    'attributes.title',
    'attributes.group',
    'attributes.group.ok',
    'footer.nav',
    'footer.nav.#.label',
    'footer.nav.#.group',
    'footer.nav.#.group.metaTitle'
  ]);
});

test('determinate stops at a path no config can name', () => {
  expect(paths(walkFields(fields, { determinate: true }))).toEqual([
    '',
    'layout.components',
    'attributes.title',
    'attributes.group',
    'attributes.group.ok',
    'footer.nav'
  ]);
});

test('walkValues names the indexes the document has', () => {
  const data = {
    layout: { components: [{ type: 'slider', image: 'a.jpg' }] },
    attributes: { title: 'Hello', group: { ok: true } },
    footer: { nav: [{ label: 'a', _children: [{ label: 'b' }] }] }
  };
  expect(paths(walkValues(fields, data))).toEqual([
    '',
    'layout.components',
    'layout.components.0:slider.image',
    'layout.components.0:slider.type',
    'attributes.title',
    'attributes.group',
    'attributes.group.ok',
    'footer.nav',
    'footer.nav.0.label',
    'footer.nav.0._children.0.label'
  ]);
});

test('walkValues skips a field the document does not carry', () => {
  expect(paths(walkValues(fields, { attributes: { title: 'Hello' } }))).toEqual([
    '',
    'attributes.title'
  ]);
});

test('walkValues carries the value at each path', () => {
  const visits = [...walkValues(fields, { attributes: { group: { ok: true } } })];
  const ok = visits.find((visit) => visit.path === 'attributes.group.ok');
  expect(ok?.value).toBe(true);
  expect(isFormField(ok!.field)).toBe(true);
});

test('matchesSegment reads # as an index', () => {
  expect(matchesSegment('#:hero', '0:hero')).toBe(true);
  expect(matchesSegment('#:hero', '0:cta')).toBe(false);
  expect(matchesSegment('#', '7')).toBe(true);
  expect(matchesSegment('#', 'meta')).toBe(false);
  expect(matchesSegment('meta', 'meta')).toBe(true);
  expect(matchesSegment('meta', 'seo')).toBe(false);
});
