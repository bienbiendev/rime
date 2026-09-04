/**
 * How a feature declares what its augment does to a config's *type*.
 *
 * The registry used to spell this out itself:
 *
 * ```ts
 * ): WithNormalizedUpload<WithVersionsConfig<T>>;
 * ```
 *
 * — a registry naming two of its entries, and importing their internals to do it. That is the
 * type-level form of the same inversion the pipeline had: the thing meant to be extended knowing
 * the extensions by name. A feature that started or stopped narrowing meant editing the registry.
 *
 * Now each feature merges its own transform in, beside its own definition:
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
 * the type already covers, and those stay absent from here — the fold below skips a name it does
 * not find, so absence means "leaves the type alone".
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
 * `FeatureConfigAugment` above is for `augment`, which runs per prototype config;
 * this is its twin for `configure`, which runs over the whole thing.
 *
 * It exists because without it a whole-config step cannot be a feature's at all. Config steps that
 * *refine* the config's type — `augmentStaff` making `collections` non-empty, the panel's making
 * `config.panel` present — had to stay hand-written calls in `core/config/build{,.server}.ts`,
 * where core named the feature that owned them. `configureWithFeatures` returned `T`, so routing
 * them through it dropped the narrowing and lit up `boot.server.ts`, `panel/navigation.ts` and
 * `handlers/auth.server.ts`.
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
