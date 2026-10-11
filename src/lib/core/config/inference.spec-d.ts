import { expectTypeOf, test } from 'vitest';

/**
 * Guards the config factory's type inference chain. vitest type-checks this file
 * (`typecheck` in vite.config.ts) against the types of the installed fixture: `test:unit`
 * installs `basic`, which declares collections and areas.
 *
 * A user's config flows through augmentConfig() — a literal sequence of
 * `const withX = augmentX(prev)` calls — into BuildConfig<C>, createRime<C>, the generated
 * .rime config module and finally App.Locals['rime']. Every step narrows the next, and it is
 * that narrowing which carries the collection and area slug *literals*, and the plugin action
 * types, all the way to `event.locals.rime`.
 *
 * Replace that chain with a loop or a reduce over an array of augments and the return type
 * widens: slug unions become `string`, plugin actions become `any`, and autocompletion dies in
 * every consumer app. The assertions below then fail the type check.
 */

type Rime = App.Locals['rime'];

/** A union of string literals: not `string`, not `never`. */
type IsLiteralUnion<T> = [T] extends [never] ? false : string extends T ? false : true;

// mailer only exists when the config declares $smtp, so it is read conditionally: this holds
// for the fixtures that declare it (basic, fields) and the ones that do not (versions, empty).
type Mailer = Rime extends { mailer: infer M } ? M : unknown;

test('a user config’s slug literals reach event.locals.rime', () => {
  expectTypeOf<IsLiteralUnion<Parameters<Rime['collection']>[0]>>().toEqualTypeOf<true>();
  expectTypeOf<IsLiteralUnion<Parameters<Rime['area']>[0]>>().toEqualTypeOf<true>();
});

test('what createRime hangs off the context is typed, not any', () => {
  expectTypeOf<Rime['auth']>().not.toBeAny();
  expectTypeOf<Rime['adapter']>().not.toBeAny();
  expectTypeOf<Rime['config']>().not.toBeAny();
  expectTypeOf<Rime['logger']>().not.toBeAny();
});

test('the core plugins are present and typed, not any', () => {
  // cache and sse are unconditional, reached through $InferPluginsServer
  expectTypeOf<Rime['cache']>().not.toBeAny();
  expectTypeOf<Rime['cache']>().not.toBeNever();
  expectTypeOf<Rime['cache']['clear']>().not.toBeAny();
  expectTypeOf<Rime['sse']>().not.toBeAny();
  expectTypeOf<Rime['sse']>().not.toBeNever();
  expectTypeOf<Rime['sse']['emit']>().not.toBeAny();
  expectTypeOf<Mailer>().not.toBeAny();
});
