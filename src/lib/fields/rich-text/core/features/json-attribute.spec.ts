import { describe, expect, test } from 'vitest';
import { jsonAttribute } from './json-attribute.js';

/** An element whose `json` attribute holds `value`, and that has no other attribute. */
const element = (value: string | null) =>
  ({ getAttribute: (name: string) => (name === 'json' ? value : null) }) as unknown as HTMLElement;

describe('jsonAttribute', () => {
  const attribute = jsonAttribute('json');

  test('writes an object as JSON', () => {
    expect(attribute.renderHTML!({ json: { a: 1 } })).toEqual({ json: '{"a":1}' });
    expect(attribute.renderHTML!({ json: null })).toEqual({});
  });

  test('reads JSON back, and nothing from a missing or broken attribute', () => {
    expect(attribute.parseHTML!(element('{"a":1}'))).toEqual({ a: 1 });
    expect(attribute.parseHTML!(element(null))).toBe(null);
    expect(attribute.parseHTML!(element(''))).toBe(null);
    expect(attribute.parseHTML!(element('[object Object]'))).toBe(null);
  });
});
