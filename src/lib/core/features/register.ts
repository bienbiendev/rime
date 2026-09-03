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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
