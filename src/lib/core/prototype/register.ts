/**
 * How a prototype declares what its whole-config `configure` does to the config's *type*.
 *
 * The same device as `features/register.js`, and for the same reason. `augmentPrototypes` used to
 * do this job inside the config factory:
 *
 * ```ts
 * collections: config.collections || [],
 * areas: config.areas || []
 * ```
 *
 * — core naming the two kinds, and owning the shape of their lists, which is exactly the
 * inversion commit 1 removed everywhere else. A third prototype meant editing that file.
 *
 * Now each prototype merges its own transform in, beside its own definition:
 *
 * ```ts
 * declare module '$lib/core/prototype/register.js' {
 *   interface PrototypeConfigure<T> {
 *     collection: T & { collections: BuiltCollection[] };
 *   }
 * }
 * ```
 *
 * Only a prototype that *changes* the type declares anything; the fold skips a name it does not
 * find, so absence means "leaves the type alone".
 */
// `T` is unused here on purpose — an empty declaration-merging target cannot reference its own
// parameter, and every merged member does use it. Same as `FeatureConfigAugment`.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
export interface PrototypeConfigure<T> {}

/**
 * Applies each named prototype's declared transform, in registry order.
 *
 * A list rather than a set, matching `ApplyAugments`: the runtime step folds the registry in
 * order, so the type has to fold in the same order to stay honest about a transform that is not
 * merely additive. A name with no declaration passes the type through untouched.
 */
export type ApplyPrototypeConfigure<T, Names extends readonly unknown[]> = Names extends readonly [
  infer Head,
  ...infer Tail
]
  ? Head extends keyof PrototypeConfigure<T>
    ? ApplyPrototypeConfigure<PrototypeConfigure<T>[Head], Tail>
    : ApplyPrototypeConfigure<T, Tail>
  : T;
