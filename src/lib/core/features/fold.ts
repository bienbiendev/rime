import type { Dic } from '$lib/util/types.js';
import type { BlankIntent, FeatureDefinition } from './define.js';
import type { DocTypeContribution } from './doc-type.js';
import type { BuiltConfig } from '$lib/core/config/types.js';

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
 * The return type is **declared, not folded**. It used to be `ApplyFeatureConfigure<T>`, a
 * recursion over `ConfigureTransforms = ['panel', 'cors']` — a hand-written list of the two
 * features that merged a declaration into `FeatureConfigure`. All it ever produced was these
 * three members, and `BuiltConfig` already declares all three by hand.
 *
 * Naming them here keeps the one property the fold existed for: with a **generic** `T` —
 * `bootRime<C>` reads `config.panel.language` while `C` is still a type parameter — an
 * intersection built from a key union stays deferred, and `panel` never resolves. A concrete
 * `Pick` is decidable immediately.
 */
export const configureWithFeatures = <T extends Dic>(
  features: FeatureDefinition[],
  config: T
): T & Pick<BuiltConfig, 'panel' | 'icons' | '$trustedOrigins'> =>
  features.reduce(
    (current, feature) => (feature.configure ? (feature.configure(current) as T) : current),
    config
  ) as unknown as T & Pick<BuiltConfig, 'panel' | 'icons' | '$trustedOrigins'>;

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
