import type { Dic } from '$lib/util/types.js';
import type { BlankIntent, FeatureDefinition } from './define.js';
import type { DocTypeContribution } from './doc-type.js';
import type { ColumnDeclaration, TableDeclaration } from './tables.js';
import type { ApplyFeatureConfigure } from './register.js';

/**
 * Asking the features a question about a config, and folding the answers.
 *
 * **Not a registry** — it was called one for a while, which is most of why it read as machinery.
 * There is no list of features here and never was: a prototype lists the ones that extend it, by
 * value and in order (see `definePrototype`), and each feature carries its own name. What lives
 * here is one function per seam on `FeatureDefinition`, each taking the feature list its caller
 * already holds and folding what those features say.
 *
 * Every one of them takes a **feature list**. Three used to take the prototypes and call
 * `distinct` themselves, which meant two shapes of call for the same idea; `distinctFeatures` is
 * exported instead and the two callers that need the union compute it once.
 */

/**
 * Every feature any prototype lists, once each.
 *
 * Deduplicated by name: a feature extending both prototypes is listed by both, and a whole-config
 * step must not run twice for it. Order is prototype order then list order — stable, and all any
 * caller needs, since none of these steps interleaves with a core one.
 */
export const distinctFeatures = (
  prototypes: { features: FeatureDefinition[] }[]
): FeatureDefinition[] => [
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
  features: FeatureDefinition[],
  config: T
): ApplyFeatureConfigure<T> =>
  features.reduce(
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
 * Takes the deduplicated list, like the other whole-config steps: a feature both prototypes list
 * must not contribute its tables twice.
 */
export const tablesOf = (features: FeatureDefinition[], config: Dic): TableDeclaration[] =>
  features.flatMap((feature) => feature.tables?.(config) ?? []);

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

/**
 * Every error the features extending a config report about it.
 *
 * Folded the same way `versionsTableOf` is — over the prototype's own feature list, gated by `enabled` —
 * so a feature's rules are asked of a config that has the feature, and core never tests for one.
 * Takes a feature list rather than the prototypes because the caller already holds one: it named
 * the prototype whose configs it is iterating.
 */
export const validateWithFeatures = (features: FeatureDefinition[], config: Dic): string[] =>
  features.flatMap((feature) =>
    feature.enabled(config) ? (feature.validate?.(config) ?? []) : []
  );

/**
 * A blank document, after every feature the config enables has shaped it.
 *
 * Folded in the prototype's feature order, like the augments — a feature that declares nothing
 * passes it through. `intent` says which blank: what an author's create starts from, or the row
 * `boot` writes for a singleton that has none. Was two identical folds, `blankWithFeatures` and
 * `seedWithFeatures`, over two identical seams with one implementer each.
 */
export const blankWithFeatures = (
  features: FeatureDefinition[],
  doc: Dic,
  config: Dic,
  intent: BlankIntent
): Dic =>
  features.reduce(
    (current, feature) =>
      feature.enabled(config) && feature.blank ? feature.blank(current, config, intent) : current,
    doc
  );
