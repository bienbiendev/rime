import { expect, test } from 'vitest';

/**
 * Guards the config factory's type inference chain, which has no other automated check.
 *
 * A user's config flows through augmentConfig() — a literal sequence of
 * `const withX = augmentX(prev)` calls — into BuildConfig<C>, createRime<C>, the generated
 * .rime config module and finally App.Locals['rime']. Every step narrows the next, and it is
 * that narrowing which carries the collection and area slug *literals*, and the plugin action
 * types, all the way to `event.locals.rime`.
 *
 * Replace that chain with a loop or a reduce over an array of augments and the return type
 * widens: slug unions silently become `string`, plugin actions become `any`, autocompletion
 * dies in every consumer app, and nothing else in the test suite notices. The assertions below
 * fail to compile if that happens — they are type-level, the runtime expect() just gives them
 * a home.
 */

type Rime = App.Locals['rime'];

/** false once T has widened to `string`. */
type IsLiteralUnion<T> = string extends T ? false : true;
/** `any` swallows everything, so it is the one type that satisfies both branches. */
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

// --- the prototype slugs a config declares -----------------------------------------------
const collectionSlugsAreLiteral: IsLiteralUnion<Parameters<Rime['collection']>[0]> = true;
const areaSlugsAreLiteral: IsLiteralUnion<Parameters<Rime['area']>[0]> = true;

// --- what createRime hangs off the context ------------------------------------------------
const authIsTyped: IsAny<Rime['auth']> = false;
const adapterIsTyped: IsAny<Rime['adapter']> = false;
const configIsTyped: IsAny<Rime['config']> = false;
const loggerIsTyped: IsAny<Rime['logger']> = false;

// --- core plugins, reached through $InferPluginsServer -------------------------------------
// cache and sse are unconditional, so they must be present, typed, and not `never`.
const cacheIsTyped: IsAny<Rime['cache']> = false;
const cacheIsPresent: IsNever<Rime['cache']> = false;
const cacheClearIsCallable: IsAny<Rime['cache']['clear']> = false;
const sseIsTyped: IsAny<Rime['sse']> = false;
const sseIsPresent: IsNever<Rime['sse']> = false;
const sseBroadcastIsCallable: IsAny<Rime['sse']['broadcast']> = false;

// mailer only exists when the config declares $smtp — asserted conditionally so this holds for
// the fixtures that do (basic, fields) and the ones that do not (versions, empty) alike.
type Mailer = Rime extends { mailer: infer M } ? M : unknown;
const mailerIsTyped: IsAny<Mailer> = false;

test('a user config’s slug literals still reach event.locals.rime', () => {
  expect(collectionSlugsAreLiteral).toBe(true);
  expect(areaSlugsAreLiteral).toBe(true);
});

test('the rime context and its core plugins are still typed, not any', () => {
  expect([authIsTyped, adapterIsTyped, configIsTyped, loggerIsTyped]).toEqual([
    false,
    false,
    false,
    false
  ]);
  expect([cacheIsTyped, cacheIsPresent, cacheClearIsCallable]).toEqual([false, false, false]);
  expect([sseIsTyped, sseIsPresent, sseBroadcastIsCallable]).toEqual([false, false, false]);
  expect(mailerIsTyped).toBe(false);
});
