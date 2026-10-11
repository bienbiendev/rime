import { describe, expectTypeOf, it } from 'vitest';
import type { BlockRenderProps } from './index.js';

describe('BlockRenderProps', () => {
  it('hands the render the locale the document is edited in', () => {
    expectTypeOf<BlockRenderProps['locale']>().toEqualTypeOf<string | undefined>();
  });
});
