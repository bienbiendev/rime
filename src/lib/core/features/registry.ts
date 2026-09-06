import type { Handle } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition, ShadowDeclaration } from './define.js';
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
 * Runs every feature's `configure` over the whole config.
 *
 * The runtime order is the prototypes' own — `distinct` above — and **the type does not replay
 * it**, because it does not need to: every declared `configure` transform is additive, so how they
 * compose does not change the result. `ApplyFeatureConfigure` folds `ConfigureTransforms`, a list
 * of the names that declare something, for a reason that is about type resolution rather than
 * order — see the note beside it in `register.ts`. Nothing here has to agree with anything at
 * runtime, so there is nothing here to drift.
 */
export const configureWithFeatures = <T extends Dic>(
  prototypes: { features: FeatureDefinition[] }[],
  config: T
): ApplyFeatureConfigure<T> =>
  distinct(prototypes).reduce(
    (current, feature) => (feature.configure ? (feature.configure(current) as T) : current),
    config
  ) as unknown as ApplyFeatureConfigure<T>;

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

/**
 * The shadow a config's content lives in, or `undefined` when it lives on the config's own row.
 *
 * Folded over the features that extend the prototype, in their declared order, and the first one
 * answering wins — a config cannot have its content in two places at once, and the order the
 * prototype listed is the tie-break. `enabled` gates it, so the question is asked of the config
 * rather than of the kind.
 *
 * Takes a feature list rather than the prototypes, because both callers already hold one: the
 * schema generator folds it per prototype config, and registration passes the prototype's own.
 */
export const shadowOf = (
  features: FeatureDefinition[],
  config: Dic
): ShadowDeclaration | undefined =>
  features.reduce<ShadowDeclaration | undefined>(
    (found, feature) => found ?? (feature.enabled(config) ? feature.shadow?.(config) : undefined),
    undefined
  );
