import enFields from '#lib/core/i18n/en/fields.js';
import frFields from '#lib/core/i18n/fr/fields.js';
import i18n from '#lib/core/i18n/index.js';
import { beforeEach, describe, expect, test } from 'vitest';
import type { RichTextFeature } from '../types.js';
import { HeadingFeature } from './heading.js';

/** The labels of the feature's menu items, in order. */
const labels = (feature: RichTextFeature) => feature.nodes?.map((node) => node.label);

describe('HeadingFeature', () => {
  beforeEach(() => {
    i18n.init({ fields: enFields });
  });

  test('without levels, all six', () => {
    const feature = HeadingFeature();
    expect(labels(feature)).toEqual([1, 2, 3, 4, 5, 6].map((level) => `Heading ${level}`));
    expect(feature.extension?.options.levels).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('with levels, those only', () => {
    const feature = HeadingFeature(2, 3);
    expect(labels(feature)).toEqual(['Heading 2', 'Heading 3']);
    expect(feature.extension?.options.levels).toEqual([2, 3]);
  });

  test('a label reads the dictionaries loaded after the feature is built', () => {
    const feature = HeadingFeature(2);
    i18n.init({ fields: frFields });
    expect(labels(feature)).toEqual(['Titre 2']);
  });
});
