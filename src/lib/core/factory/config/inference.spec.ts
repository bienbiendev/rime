import { expect, test } from 'vitest';

/**
 * Guards the config factory's type inference chain, which has no other automated check.
 *
 * A user's config flows through augmentConfig() — a literal sequence of
 * `const withX = augmentX(prev)` calls — into BuildConfig<C>, createRime<C>, the generated
 * .rime config module and finally App.Locals['rime']. Every step narrows the next, and it is
 * that narrowing which carries the collection and area slug *literals* all the way to
 * `event.locals.rime.collection('...')`.
 *
 * Replace that chain with a loop or a reduce over an array of augments and the return type
 * widens: the slug unions silently become `string`, autocompletion dies in every consumer app,
 * and nothing else in the test suite notices. The assertions below fail to compile if that
 * happens — they are type-level, the runtime expect() just gives them a home.
 */

type Rime = App.Locals['rime'];
type CollectionSlugArg = Parameters<Rime['collection']>[0];
type AreaSlugArg = Parameters<Rime['area']>[0];

/** false once T has widened to `string`. */
type IsLiteralUnion<T> = string extends T ? false : true;

const collectionSlugsAreLiteral: IsLiteralUnion<CollectionSlugArg> = true;
const areaSlugsAreLiteral: IsLiteralUnion<AreaSlugArg> = true;

test('a user config’s slug literals still reach event.locals.rime', () => {
  expect(collectionSlugsAreLiteral).toBe(true);
  expect(areaSlugsAreLiteral).toBe(true);
});
