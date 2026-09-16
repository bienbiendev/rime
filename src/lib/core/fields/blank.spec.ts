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
} from '$lib/fields/index.js';
import { expect, test } from 'vitest';
import { blankFields } from './blank.js';

test('a blank document, one member per field', () => {
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

  expect(blankFields(fields)).toEqual({
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
