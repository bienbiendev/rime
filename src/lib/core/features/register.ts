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

/** Applies each named feature's declared `configure` transform, in the order they run. */
export type ApplyFeatureConfigure<T, Names extends readonly unknown[]> = Names extends readonly [
  infer Head,
  ...infer Tail
]
  ? Head extends keyof FeatureConfigure<T>
    ? ApplyFeatureConfigure<FeatureConfigure<T>[Head], Tail>
    : ApplyFeatureConfigure<T, Tail>
  : T;
