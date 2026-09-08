import type { Handle } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition, ShadowDeclaration, WritePlan } from './define.js';
import type { ApplyFeatureConfigure } from './register.js';
import type { OperationQuery, ReadIntent } from '$lib/core/pipeline/types.js';

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
 * Every error the features extending a config report about it.
 *
 * Folded the same way `shadowOf` is — over the prototype's own feature list, gated by `enabled` —
 * so a feature's rules are asked of a config that has the feature, and core never tests for one.
 * Takes a feature list rather than the prototypes because the caller already holds one, from
 * `prototypeEntries`.
 */
export const validateWithFeatures = (features: FeatureDefinition[], config: Dic): string[] =>
  features.flatMap((feature) =>
    feature.enabled(config) ? (feature.validate?.(config) ?? []) : []
  );

/**
 * The blank document, after every feature the config enables has shaped it.
 *
 * Folded in the prototype's feature order, like the augments — a feature that declares nothing
 * passes it through.
 */
export const blankWithFeatures = (features: FeatureDefinition[], doc: Dic, config: Dic): Dic =>
  features.reduce(
    (current, feature) =>
      feature.enabled(config) && feature.blank ? feature.blank(current, config) : current,
    doc
  );

/**
 * The write plan, after every feature the config enables has said where its half lands.
 *
 * Folded in the prototype's feature order like the blank document, starting from "everything on
 * the prototype's own row" — which is the whole plan for a config no feature gives a second row
 * to, so nothing needs a not-versioned branch.
 *
 * `runUpdate` calls this at a fixed point, after the data hooks and before the write. See
 * `FeatureDefinition.writePlan` for why it is not itself a hook.
 */
export const writePlanWithFeatures = (
  features: FeatureDefinition[],
  plan: WritePlan,
  args: { config: Dic; context: Dic }
): WritePlan =>
  features.reduce(
    (current, feature) =>
      feature.enabled(args.config) && feature.writePlan
        ? feature.writePlan(current, args)
        : current,
    plan
  );

/**
 * The filter that says which content row a read means, from whichever feature owns the difference.
 *
 * First answer wins and `enabled` gates it, like `shadowOf` — and for the same reason: a config
 * has one content row, so it has one rule for picking it. `undefined` all the way through means
 * the read is not narrowed, which is every config with no shadow.
 */
export const readQueryOf = (
  features: FeatureDefinition[],
  config: Dic,
  params: { draft?: boolean; versionId?: string },
  intent: ReadIntent
): OperationQuery | undefined =>
  features.reduce<OperationQuery | undefined>(
    (found, feature) =>
      found ??
      (feature.enabled(config) ? feature.readQuery?.({ config, params, intent }) : undefined),
    undefined
  );

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
