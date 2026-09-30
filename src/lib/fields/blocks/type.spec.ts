import { block, blocks, text } from '$lib/fields/index.js';
import { expect, test } from 'vitest';

const generated = blocks('sections', [block('card').fields(text('title'))]).use.generateType();
const cardType = generated.slice(generated.indexOf('export type BlockCard'));

test('a block type has its name as `type`, once', () => {
  expect(cardType).toContain("type: 'card'");
  expect(cardType.match(/^\s*type\??:/gm)).toHaveLength(1);
});

test('a block type keeps its fields and its path and position', () => {
  expect(cardType).toMatch(/title\?: string/);
  expect(cardType).toMatch(/path\?: string/);
  expect(cardType).toMatch(/position\?: number/);
});
