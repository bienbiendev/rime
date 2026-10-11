import { describe, expect, test } from 'vitest';
import { extractFieldName, levelsBelow } from './util.js';

describe('extractFieldName', () => {
  test('names the tree and the path inside it', () => {
    expect(extractFieldName('nav')).toEqual(['nav', '']);
    expect(extractFieldName('nav.0._children')).toEqual(['nav', '0._children']);
    expect(extractFieldName('nav.0._children.1._children')).toEqual([
      'nav',
      '0._children.1._children'
    ]);
    expect(extractFieldName('group.nav')).toEqual(['nav', '']);
    expect(extractFieldName('sections.0:keyFacts.facts.0._children')).toEqual([
      'facts',
      '0._children'
    ]);
  });

  test('names nothing for a path that ends on an item', () => {
    expect(extractFieldName('nav.0')).toEqual(['', '']);
  });
});

describe('levelsBelow', () => {
  test('counts the levels under an item, not its children', () => {
    expect(levelsBelow({ _children: [] })).toBe(0);
    expect(levelsBelow({ _children: [{ _children: [] }] })).toBe(1);
    expect(levelsBelow({ _children: [{ _children: [{ _children: [] }] }] })).toBe(2);
    expect(levelsBelow({ _children: [{}, {}, {}] })).toBe(1);
  });
});
