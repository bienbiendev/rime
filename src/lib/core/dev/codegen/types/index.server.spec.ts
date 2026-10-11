import { expect, it } from 'vitest';
import { parseSharedTypes } from './index.server.js';

const block = (fields: string) =>
  `//@shared:start BlockImage\nexport type BlockImage = { ${fields} }\n//@shared:end`;

it('hoists one copy of a repeated type', () => {
  const { shared } = parseSharedTypes(`${block('a: string')}\n${block('a:  string')}\n`);
  expect(shared).toBe('export type BlockImage = { a: string }');
});

it('refuses two different types under one name', () => {
  expect(() => parseSharedTypes(`${block('a: string')}\n${block('b: number')}\n`)).toThrow(
    'BlockImage'
  );
});
