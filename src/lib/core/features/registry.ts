import type { Handle } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import type { FeatureDefinition } from './define.js';
import type { ApplyFeatureConfigure } from './register.js';

/**
 * The whole-config feature steps, and nothing else.
 *
 * There is no list of features here: a prototype lists the ones that extend it, by value and in
 * order (see `definePrototype`), and each feature carries its own name. What lives here are the
 * three steps that are about no single prototype — `configure` (auth's `staff` collection,
 * upload's derived directories), `boot` (once per process) and `handler` (per request) — each of
 * which needs every feature in play, which is the union of what the prototypes listed.
 */

/**
 * Every feature any prototype lists, once each.
 *
 * Deduplicated by name: a feature extending both prototypes is listed by both, and these steps
 * must not run twice for it. Order is prototype order then list order — stable, and all these
 * steps need, since none of them interleaves with core steps.
 */
const distinct = (prototypes: { features: FeatureDefinition[] }[]): FeatureDefinition[] => [
  ...new Map(
    prototypes.flatMap((prototype) => prototype.features).map((feature) => [feature.name, feature])
  ).values()
];

/**
 * The features that carry a whole-config `configure`, in the order they run.
 *
 * A tuple of **names only** — never `typeof someFeature`, which is load-bearing. The order comes
 * from the prototypes' `features` lists at runtime, and a type cannot read it back off them: the
 * registry those lists reach through is annotated so that no feature's hooks land in
 * `BuildConfig`'s type graph. String literals name the transforms without naming the features, so
 * the fold costs nothing.
 *
 * It has to agree with the runtime order, and `registry.spec.ts` asserts that against the real
 * prototypes, so drift fails a test rather than silently mistyping the config.
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
 * A feature with no `handler` contributes nothing, and on a client build a server-only handler
 * resolves to `undefined` — hence the filter.
 */
export const featureHandlers = (prototypes: { features: FeatureDefinition[] }[]): Handle[] =>
  distinct(prototypes)
    .map((feature) => feature.handler)
    .filter((handler): handler is Handle => typeof handler === 'function');
