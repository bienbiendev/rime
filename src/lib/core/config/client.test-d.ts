import { describe, expectTypeOf, it } from 'vitest';
import type { BuiltConfigClient, SanitizedConfigClient } from './types.js';

describe('the client config types', () => {
  it('have none of the `$` members the sanitizer drops', () => {
    expectTypeOf<SanitizedConfigClient>().not.toHaveProperty('$cache');
    expectTypeOf<SanitizedConfigClient>().not.toHaveProperty('$sse');
    expectTypeOf<SanitizedConfigClient>().not.toHaveProperty('$smtp');
    expectTypeOf<BuiltConfigClient>().not.toHaveProperty('$tables');
  });

  it('keep the members the client reads', () => {
    expectTypeOf<SanitizedConfigClient>().toHaveProperty('collections');
    expectTypeOf<BuiltConfigClient>().toHaveProperty('panel');
  });
});
