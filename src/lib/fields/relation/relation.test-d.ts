import type { RelationValue } from '$lib/fields/types.js';
import { describe, expectTypeOf, it } from 'vitest';
import { Relation } from './relation.js';

type Doc = { id: string; _type: string; alt?: string };
const m1: Doc = { id: 'm1', _type: 'medias' };

describe('Relation.resolve types', () => {
  it('reads the document type off the value', () => {
    expectTypeOf(Relation.resolve({} as RelationValue<Doc> | undefined).first()).toEqualTypeOf<
      Doc | null | Promise<Doc | null>
    >();
    expectTypeOf(Relation.resolve([m1]).all()).toEqualTypeOf<Doc[] | Promise<Doc[]>>();
    expectTypeOf(Relation.resolve(m1).first()).toEqualTypeOf<Doc | null | Promise<Doc | null>>();
  });
});
