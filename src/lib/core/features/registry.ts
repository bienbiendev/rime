import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition } from './define.js';

/**
 * The whole-config feature steps, and nothing else.
 *
 * This file used to be the registry: a barrel of every feature, the source of each one's name,
 * and the per-prototype filter that `extends` fed. All three are gone. A prototype lists the
 * features that extend it, by value and in order (see `definePrototype`), so there is no central
 * list to consult and no name to look up — the feature carries its own.
 *
 * What survives is the two steps that are not about any one prototype: `configure` adds
 * collections to the *whole* config (upload derives a `<slug>Directories` per upload collection),
 * and `boot` runs once per process (`ensureMedias`). Those need every feature in play, which is
 * the union of what the prototypes listed.
 */

/**
 * Every feature any prototype lists, once each.
 *
 * Deduplicated by name, because a feature that extends both prototypes is listed by both — and
 * `configure`/`boot` must not run twice for it. Order is prototype order then list order, which
 * is stable and, for these two steps, is all that is needed: neither has core steps to interleave
 * with, so `requires` — checked where each prototype declares its list — is the only ordering
 * that matters.
 */
const distinct = (prototypes: { features: FeatureDefinition[] }[]): FeatureDefinition[] => [
  ...new Map(
    prototypes.flatMap((prototype) => prototype.features).map((feature) => [feature.name, feature])
  ).values()
];

/** Runs every feature's `configure` over the whole config. */
export const configureWithFeatures = <T extends Dic>(
  prototypes: { features: FeatureDefinition[] }[],
  config: T
): T =>
  distinct(prototypes).reduce(
    (current, feature) => (feature.configure ? (feature.configure(current) as T) : current),
    config
  );

/** Runs every feature's boot step. */
export const bootFeatures = async (
  prototypes: { features: FeatureDefinition[] }[],
  config: Dic
): Promise<void> => {
  for (const feature of distinct(prototypes)) {
    await feature.boot?.(config);
  }
};
