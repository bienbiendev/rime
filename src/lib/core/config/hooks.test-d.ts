import { describe, expectTypeOf, it } from 'vitest';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { AreaHooks, CollectionHooks } from './types.js';

const afterUpsert = Hooks.afterUpsert(async (args) => args);

describe('afterUpdate hooks', () => {
  it('take an afterUpsert hook on a collection and on an area alike', () => {
    expectTypeOf(afterUpsert).toExtend<
      NonNullable<CollectionHooks<'raw'>['afterUpdate']>[number]
    >();
    expectTypeOf(afterUpsert).toExtend<NonNullable<AreaHooks<'raw'>['afterUpdate']>[number]>();
  });
});
