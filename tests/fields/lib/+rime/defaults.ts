import {
  block,
  blocks,
  checkbox,
  date,
  number,
  relation,
  text,
  toggle,
  tree
} from '$lib/fields/index.js';
import { Collection } from '$rime/config';

/**
 * Each kind of field twice, once per fill, for `tests/fields/defaults.test.ts`. A relation's
 * default names targets the test creates with these ids.
 */
const memo = block('memo').fields(text('text'));

export const Defaults = Collection.create('defaults', {
  fields: [
    text('title').isTitle(),
    text('textCreate').defaultValue('Default'),
    text('textSave').defaultValue('Default', { fill: 'save' }),
    number('numberCreate').defaultValue(5),
    number('numberSave').defaultValue(5, { fill: 'save' }),
    toggle('toggleCreate').defaultValue(true),
    toggle('toggleSave').defaultValue(true, { fill: 'save' }),
    checkbox('checkboxCreate').defaultValue(true),
    checkbox('checkboxSave').defaultValue(true, { fill: 'save' }),
    date('dateCreate').defaultValue(() => new Date()),
    date('dateSave').defaultValue(() => new Date(), { fill: 'save' }),
    relation('relationCreate').to('targets').defaultValue('defaults-target-1'),
    relation('relationSave').to('targets').defaultValue('defaults-target-1', { fill: 'save' }),
    blocks('blocksCreate', [memo]).defaultValue([{ type: 'memo', text: 'Default' }]),
    blocks('blocksSave', [memo]).defaultValue([{ type: 'memo', text: 'Default' }], {
      fill: 'save'
    }),
    tree('treeCreate')
      .fields(text('label'))
      .defaultValue([{ label: 'Default' }]),
    tree('treeSave')
      .fields(text('label'))
      .defaultValue([{ label: 'Default' }], { fill: 'save' })
  ]
});
