import type { Handle } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import type { FeatureDefinition } from './define.js';
import type { ApplyFeatureConfigure } from './register.js';

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

/**
 * The features that carry a whole-config `configure`, in the order they run.
 *
 * A tuple of **names only** — no `typeof someFeature` — and that is load-bearing. The order comes
 * from the prototypes' `features` lists at runtime, and a type cannot read it back off them: the
 * registry those lists reach through is annotated precisely so that no feature's hooks land in
 * `BuildConfig`'s type graph (rule 1 in docs/restructure-handoff.md). String literals name the
 * transforms without naming the features, so the fold costs nothing.
 *
 * It has to agree with the runtime order, and `registry.spec.ts` asserts exactly that against the
 * real prototypes, so drift fails a test rather than silently mistyping the config.
 */
export const configureOrder = ['auth', 'panel', 'upload', 'versions', 'cors'] as const;

/**
 * Runs every feature's `configure` over the whole config.
 *
 * The runtime order is the prototypes' own — `distinct` below — and the type replays it through
 * `configureOrder`. A feature not listed there still runs; it just declares no type transform,
 * which is the same thing absence means on the augment side.
 */
export const configureWithFeatures = <T extends Dic>(
  prototypes: RegisteredPrototype[],
  config: T
): ApplyFeatureConfigure<T, typeof configureOrder> =>
  distinct(prototypes).reduce(
    (current, feature) =>
      feature.configure
        ? (feature.configure(current, prototypes as RegisteredPrototype[]) as T)
        : current,
    config
  ) as unknown as ApplyFeatureConfigure<T, typeof configureOrder>;

/** Runs every feature's boot step. */
export const bootFeatures = async (
  prototypes: { features: FeatureDefinition[] }[],
  config: Dic
): Promise<void> => {
  for (const feature of distinct(prototypes)) {
    await feature.boot?.(config);
  }
};

/**
 * Every feature's request handler, in prototype-then-list order.
 *
 * The third whole-config step, beside `configure` and `boot`: not about any one prototype, so it
 * needs the union of what the prototypes listed. A feature with no `handler` contributes nothing,
 * and on a client build a server-only handler resolves to `undefined` — hence the filter.
 */
export const featureHandlers = (prototypes: { features: FeatureDefinition[] }[]): Handle[] =>
  distinct(prototypes)
    .map((feature) => feature.handler)
    .filter((handler): handler is Handle => typeof handler === 'function');
