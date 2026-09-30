import { block, blocks, text, tree } from '$lib/fields/index.js';
import { Area } from '$rime/config';

/**
 * An area whose first boot writes its defaults, lists included, for
 * `tests/fields/defaults.test.ts`.
 */
export const Homepage = Area.create('homepage', {
  fields: [
    text('title').defaultValue('Home'),
    blocks('sections', [block('intro').fields(text('text'))]).defaultValue([
      { type: 'intro', text: 'Welcome' }
    ]),
    tree('menu')
      .fields(text('label'))
      .defaultValue([{ label: 'Home', _children: [{ label: 'About' }] }])
  ]
});
