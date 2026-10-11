import { describe, expect, test } from 'vitest';
import type { RichTextFeature } from '../types.js';
import { HeadingFeature } from './heading.js';

/** The labels of the feature's menu items, in order. */
const labels = (feature: RichTextFeature) => feature.nodes?.map((node) => node.label);

describe('HeadingFeature', () => {
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
});
