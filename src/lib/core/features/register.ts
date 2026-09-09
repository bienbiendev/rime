/**
 * How a feature declares a **document shape** into core's `Docs` registry.
 *
 * `Docs` maps a `DocType` to what a document of that type looks like, and four of its entries were
 * a feature's: `upload`, `version`, `auth` and `directory`. Core declaring them meant
 * `core/prototype/types.ts` importing `UploadPath` and `VersionsStatus` out of two features to
 * spell its own registry.
 *
 * Merged the same way `FeatureConfigAugment` is, beside the feature's own types:
 *
 * ```ts
 * declare module '$lib/core/features/register.js' {
 *   interface FeatureDocTypes {
 *     version: VersionDoc;
 *   }
 * }
 * ```
 *
 * The prototype slugs come the other way, through `RegisterCollection`/`RegisterArea`, which
 * codegen writes. This is the same mechanism for the shapes a feature adds rather than a config.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureDocTypes {}

/**
 * How a feature declares what its `augment` does to a prototype config's *type*.
 *
 * Each feature merges its own transform in, beside its own definition, so nothing central names
 * the features that narrow a config:
 *
 * ```ts
 * declare module '$lib/core/features/register.js' {
 *   interface FeatureConfigAugment<T> {
 *     upload: WithNormalizedUpload<T>;
 *   }
 * }
 * ```
 *
 * Only a feature that *changes* the type declares anything. Most augments append fields, which
 * the type already covers; the fold below skips a name it does not find, so absence means "leaves
 * the type alone".
 */
// `T` is unused here on purpose: an empty declaration-merging target cannot reference its own
// parameter, and every merged member does use it (`title: T & { asTitle: string }`).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
export interface FeatureConfigAugment<T> {}

/**
 * Applies each named feature's declared transform, in order.
 *
 * Order matters and is a list rather than a set: `upload` normalises before `title` reads the
 * fallback it leaves. A name with no declaration passes the type through untouched.
 */
export type ApplyAugments<T, Names extends readonly unknown[]> = Names extends readonly [
  infer Head,
  ...infer Tail
]
  ? Head extends keyof FeatureConfigAugment<T>
    ? ApplyAugments<FeatureConfigAugment<T>[Head], Tail>
    : ApplyAugments<T, Tail>
  : T;

/**
 * How a feature declares what its **whole-config** `configure` does to the config's type.
 *
 * The twin of `FeatureConfigAugment` above: that one is for `augment`, which runs per prototype
 * config, this one for `configure`, which runs over the whole thing. It is what lets a
 * type-refining step belong to a feature — `configureWithFeatures` folds these declarations, so
 * `config.panel` is present and `config.$trustedOrigins` is a list for everything downstream.
 *
 * ```ts
 * declare module '$lib/core/features/register.js' {
 *   interface FeatureConfigure<T> {
 *     panel: T & { icons: Dic<Component<IconProps>>; panel: PanelConfig };
 *   }
 * }
 * ```
 *
 * As with the augment side: only a feature that changes the type declares anything, and a name
 * with no declaration passes the type through untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
export interface FeatureConfigure<T> {}

/**
 * The features that declare a `configure` transform, as a list.
 *
 * **The order is not meaningful and does not have to match anything.** Every declaration merged
 * into `FeatureConfigure` is additive — `T & {…}` — so the result is the same whichever way they
 * compose; `registry.spec.ts` asserts that additivity, and asserts that this list covers every
 * declaration. It is deliberately not called an "order", and it is deliberately not the order the
 * `configure` steps run in at runtime: that order is the prototypes' `features` lists, and nothing
 * type-level reads it.
 *
 * A list rather than `keyof FeatureConfigure<T>` for one reason, and it is the reason this exists
 * at all: with a **generic** `T` — `bootRime<C>` reads `config.panel.language` while `C` is still
 * a type parameter — an intersection built from a key union stays deferred, and the optional
 * `panel` on `C` survives into the result. Literal names make each step of the fold decidable
 * immediately, so the narrowed type is there when a generic caller asks for it.
 *
 * Only the features that *declare* something are listed. One that has a `configure` but changes no
 * type contributes nothing here, exactly as on the augment side.
 */
export type ConfigureTransforms = ['panel', 'cors'];

/** Applies every declared `configure` transform. See `ConfigureTransforms` on why it is a list. */
export type ApplyFeatureConfigure<
  T,
  Names extends readonly unknown[] = ConfigureTransforms
> = Names extends readonly [infer Head, ...infer Tail]
  ? Head extends keyof FeatureConfigure<T>
    ? ApplyFeatureConfigure<FeatureConfigure<T>[Head], Tail>
    : ApplyFeatureConfigure<T, Tail>
  : T;
