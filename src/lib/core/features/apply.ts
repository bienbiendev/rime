import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition } from './define.js';
import type { ApplyAugments } from './register.js';

/**
 * The names a feature list carries, in order — a tuple, not a union.
 *
 * This is what removes the last duplicated ordering. The type fold needs the order at compile
 * time and the reduce needs it at runtime; mapping over the `as const` list gives both from the
 * one declaration, so there is no second tuple to keep in step and no runtime check to catch it
 * when someone forgets.
 */
export type FeatureNames<F extends readonly { name: string }[]> = { [K in keyof F]: F[K]['name'] };

/** What a config becomes once a prototype's features have augmented it. */
export type Augmented<T, F extends readonly { name: string }[]> = ApplyAugments<T, FeatureNames<F>>;

/**
 * Runs each feature's `augment` over a prototype config, in the order the prototype listed them.
 *
 * The order is the prototype's, because the fields land in it and field order is column order.
 */
export const applyAugments = <T extends Dic, const F extends readonly FeatureDefinition[]>(
  features: F,
  config: T
): Augmented<T, F> =>
  features.reduce(
    // The cast is the usual one: each augment preserves the shape it is handed, but a list
    // holding augments for more than one shape cannot say so. The *result* is typed by folding
    // each feature's own declared transform over the list — see `Augmented` above.
    (current, feature) =>
      feature.augment && feature.enabled(current) ? (feature.augment(current) as T) : current,
    config
  ) as Augmented<T, F>;
