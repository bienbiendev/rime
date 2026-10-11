import {
  block,
  blocks,
  group,
  relation,
  separator,
  tab,
  tabs,
  text,
  toggle,
  tree
} from '#lib/fields/index.js';
import { expect, test, vi } from 'vitest';
import { initialValues } from './initial.js';

test('a new document, one member per field', () => {
  const fields = [
    tabs(
      tab('hero').fields(text('headline').defaultValue('Hello'), separator()),
      tab('attributes').fields(
        text('title'),
        toggle('isHome').defaultValue(false),
        group('seo').fields(text('metaTitle'), group('og').fields(text('ogTitle')))
      ),
      tab('layout').fields(
        blocks('components', [block('hero').fields(text('label'))]),
        tree('nav').fields(text('label'))
      )
    ),
    relation('author').to('staff')
  ];

  expect(initialValues(fields)).toEqual({
    hero: { headline: 'Hello' },
    attributes: {
      title: null,
      isHome: false,
      seo: { metaTitle: null, og: { ogTitle: null } }
    },
    layout: { components: [], nav: [] },
    author: []
  });
});

test('a default that throws is logged once, at the field that threw it', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failing = text('code').defaultValue(() => {
    throw new Error('no code');
  });
  const fields = [tabs(tab('meta').fields(group('seo').fields(group('og').fields(failing))))];

  expect(() => initialValues(fields)).toThrow('no code');
  expect(error.mock.calls).toEqual([['Building the value of text field "code" failed.']]);
  error.mockRestore();
});

test('a default that throws something other than an object is logged too', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failing = text('code').defaultValue(() => {
    throw 'missing';
  });

  expect(() => initialValues([failing])).toThrow('missing');
  expect(error.mock.calls).toEqual([['Building the value of text field "code" failed.']]);
  error.mockRestore();
});
