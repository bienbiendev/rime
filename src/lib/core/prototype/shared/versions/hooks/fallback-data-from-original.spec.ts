import { buildConfigMap } from '$lib/core/pipeline/config-map/index.js';
import { block, blocks, text } from '$lib/fields/index.js';
import { expect, test } from 'vitest';
import { fallbackDataFromOriginal } from './fallback-data-from-original.js';

const fields = [
  text('title'),
  text('intro'),
  text('status'),
  blocks('sections', [block('paragraph').fields(text('text'))])
];
const original = {
  title: 'A',
  intro: 'B',
  status: 'published',
  sections: [{ id: 'p', type: 'paragraph', text: 'Old' }]
};

const run = (data: Record<string, unknown>) =>
  fallbackDataFromOriginal({
    data,
    original,
    configMap: buildConfigMap(original, fields),
    ignore: ['status']
  });

test('a field not sent takes the previous version value', () => {
  expect(run({ title: 'C' })).toMatchObject({
    title: 'C',
    intro: 'B',
    sections: original.sections
  });
});

test('a field sent empty stays empty', () => {
  expect(run({ title: 'C', intro: null })).toMatchObject({ title: 'C', intro: null });
});

test('a list sent is taken as sent, empty or not', () => {
  expect(run({ sections: [] }).sections).toEqual([]);
  expect(run({ sections: [{ type: 'paragraph' }] }).sections).toEqual([{ type: 'paragraph' }]);
});

test('an ignored field is left out', () => {
  expect(run({})).not.toHaveProperty('status');
});
