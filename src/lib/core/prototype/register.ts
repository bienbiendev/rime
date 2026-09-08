/**
 * What a prototype adds to the config an **author writes** — its own list, under its own key.
 *
 * The authoring twin of `PrototypeConfigure` below: that one says what `configure` does to the
 * built config's type, this one says the member exists in the first place. Each prototype merges
 * its own, beside its own definition:
 *
 * ```ts
 * declare module '$lib/core/prototype/register.js' {
 *   interface PrototypeMembers {
 *     collections?: BuiltCollection[];
 *   }
 * }
 * ```
 *
 * `Config` extends this and `BuiltConfig` takes `Required<PrototypeMembers>` — the built config is
 * the same members with the optionality gone, which is exactly what each prototype's `configure`
 * guarantees at runtime by defaulting its list to `[]`. So `core/config/types.ts` names no kind,
 * and a third prototype costs its own folder and nothing else.
 *
 * Declared **optional** here, because that is what an author may leave out. A prototype that
 * merged a required member would make every config in the repo fail to type, which is the failure
 * mode to expect if this is ever got wrong.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PrototypeMembers {}

/**
 * How a prototype declares what its whole-config `configure` does to the config's *type*.
 *
 * The same device as `features/register.js`. Each prototype merges its own transform in, beside
 * its own definition, so core never names the kinds or owns the shape of their lists — a third
 * prototype brings its own declaration and nothing here changes:
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
 * order, so the type folds in the same order and stays honest about a transform that is not
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
