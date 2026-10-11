import { describe, expect, test } from 'vitest';
import { junctionKey, junctionTarget } from './naming.server.js';

describe('junction columns', () => {
  test('a target slug names its column, and the column names its target back', () => {
    expect(junctionKey('productIdeas')).toBe('productIdeasId');
    expect(junctionTarget('productIdeasId')).toBe('productIdeas');
  });

  test('ownerId and other columns name no target', () => {
    expect(junctionTarget('ownerId')).toBeUndefined();
    expect(junctionTarget('path')).toBeUndefined();
  });
});
