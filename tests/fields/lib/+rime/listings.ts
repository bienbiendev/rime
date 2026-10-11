import {
  component,
  group,
  link,
  number,
  richText,
  select,
  separator,
  tab,
  tabs,
  text
} from '#lib/fields/index.js';
import Notice from './components/Notice.svelte';
import { fields, paragraph } from '#lib/fields/rich-text/client.js';
import { Collection } from '$rime/config';

/**
 * What the list page and the field components read by path or by label: a title inside a group,
 * a sortable column inside a group placed first, a select whose labels are not its values.
 */
export const Listings = Collection.create('listings', {
  fields: [
    group('attributes').fields(text('heading').isTitle()),
    text('note').table({ position: 1 }),
    group('meta').fields(number('score').table({ sort: true, position: 0 })),
    select('country').options({ value: 'fr', label: 'France' }, { value: 'de', label: 'Germany' }),
    link('website').types('url', 'email'),
    // Two `fields()` nodes: each palette entry inserts its own
    richText('body').features(
      paragraph(),
      fields({ name: 'hero', label: 'Hero', fields: [text('heroTitle')] }),
      fields({ name: 'quote', label: 'Quote', fields: [text('quoteText')] })
    ),
    separator().className('rz-fixture-wide'),
    // Read by anybody: rendered
    component(Notice),
    // Read by nobody: never rendered
    component(Notice).access({ create: () => true, read: () => false, update: () => true }),
    // A condition that fails: hidden
    component(Notice).condition(() => false),
    tabs(tab('first').fields(text('firstText')), tab('second').fields(text('secondText')))
  ]
});
