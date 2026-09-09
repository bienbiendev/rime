import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition, ShadowDeclaration, WritePlan } from './define.js';
import type { DocTypeContribution } from './doc-type.js';
import type { ColumnDeclaration, TableDeclaration } from './tables.js';
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

/**
 * Every table the features in play need that no prototype declares.
 *
 * **Ungated**, and that is the decision the annex asked to have written down: `enabled` is
 * `(prototypeConfig) => boolean` and this is asked of the whole config, so gating here would test
 * the wrong object and silently emit nothing. A feature answers `[]` for a config that does not
 * use it — auth asks whether any collection declares `auth`, which is `enabled`'s test made at the
 * scope the question belongs to.
 *
 * Deduplicated by `distinct`, like the other whole-config steps: a feature both prototypes list
 * must not contribute its tables twice.
 */
export const tablesOf = (
  prototypes: { features: FeatureDefinition[] }[],
  config: Dic
): TableDeclaration[] => distinct(prototypes).flatMap((feature) => feature.tables?.(config) ?? []);

/**
 * The storage-only columns the features a config enables put on its table.
 *
 * Gated by `enabled` and folded in the prototype's feature order, like `blankWithFeatures` — this
 * one *is* per-prototype, so the gate is asked of the right object. Takes a feature list because
 * the caller already holds one: it named the prototype whose configs it is iterating.
 */
export const columnsOf = (features: FeatureDefinition[], config: Dic): ColumnDeclaration[] =>
  features.flatMap((feature) => (feature.enabled(config) ? (feature.columns?.(config) ?? []) : []));

/**
 * Everything the features a config enables add to its generated document type.
 *
 * Gated and folded in the prototype's feature order, like `columnsOf`. The `fields` predicates are
 * **ANDed** rather than replaced: each says which fields it still wants generated, and a field has
 * to survive all of them.
 */
export const docTypeWithFeatures = (
  features: FeatureDefinition[],
  config: Dic
): Required<DocTypeContribution> =>
  features.reduce<Required<DocTypeContribution>>(
    (current, feature) => {
      if (!feature.enabled(config) || !feature.docType) return current;
      const contribution = feature.docType(config);
      return {
        extends: [...current.extends, ...(contribution.extends ?? [])],
        members: [...current.members, ...(contribution.members ?? [])],
        fields: contribution.fields
          ? (field) => current.fields(field) && contribution.fields!(field)
          : current.fields
      };
    },
    { extends: [], members: [], fields: () => true }
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

/**
 * Every error the features extending a config report about it.
 *
 * Folded the same way `shadowOf` is — over the prototype's own feature list, gated by `enabled` —
 * so a feature's rules are asked of a config that has the feature, and core never tests for one.
 * Takes a feature list rather than the prototypes because the caller already holds one: it named
 * the prototype whose configs it is iterating.
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
 * `runUpdate` and `create` both call this at the same fixed point, after the data hooks and before
 * the write — which is why `operation` travels with it: an insert has no content row to name yet.
 * See `FeatureDefinition.writePlan` for why it is not itself a hook.
 */
export const writePlanWithFeatures = (
  features: FeatureDefinition[],
  plan: WritePlan,
  args: { config: Dic; context: Dic; operation: 'create' | 'update' }
): WritePlan =>
  features.reduce(
    (current, feature) =>
      feature.enabled(args.config) && feature.writePlan
        ? feature.writePlan(current, args)
        : current,
    plan
  );

/**
 * The bootstrapped first document, after every feature the config enables has shaped it.
 *
 * Folded like `blankWithFeatures`, over the same starting document, and separate from it for the
 * reason `FeatureDefinition.seed` gives: one is where an author's create begins, the other is what
 * `boot` writes for a prototype that must have a row before anybody asks.
 */
export const seedWithFeatures = (features: FeatureDefinition[], doc: Dic, config: Dic): Dic =>
  features.reduce(
    (current, feature) =>
      feature.enabled(config) && feature.seed ? feature.seed(current, config) : current,
    doc
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
