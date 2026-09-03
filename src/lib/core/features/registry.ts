import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import type { AnyHook, FeatureDefinition, HookTiming, RegisteredFeature } from './define.js';
import type { WithNormalizedUpload } from './upload/types.js';
import type { WithVersionsConfig } from './versions/augment.js';
import { nested } from './nested/index.js';
import { upload } from './upload/index.js';
import { url } from './url/index.js';
import { versions } from './versions/index.js';

/**
 * The feature registry.
 *
 * A feature's **name is its export name here**, the same rule the prototype registry follows, and
 * **the order of this object is the order features run in** — the augments a config passes
 * through, and the relative order of two features' hooks at the same pipeline timing.
 *
 * That order is checked against `requires` below rather than computed from it. A topological sort
 * would put the real order nowhere a reader can see it, and it would have nothing to say about
 * the features that require nothing of each other — which, in the document pipeline, is all of
 * them. So: read the order here, and let `requires` refuse a barrel that contradicts itself.
 *
 * The order below is the order the four prototype factories used to spell out by hand, and it has
 * to stay that way: every one of these augments appends fields, and field order is column order.
 * `pdf` in the versions-multilang fixture carries both `upload` and `versions`, so swapping two of
 * these renames nothing and silently rewrites that table.
 *
 * Not every feature has moved here yet. `versions` is registered for its augment only (see its
 * definition), and the block/tree/relation children are still loose. `auth` is not a feature at
 * all — docs/architecture-target.md settles that: it is core.
 */
const features = { upload, nested, versions, url };

export { nested, upload, url, versions };

export type FeatureName = keyof typeof features;

/** Every registered feature, each carrying the name it is exported under, in barrel order. */
export const featureList: RegisteredFeature[] = Object.entries(features).map(
  ([name, definition]) => ({ ...(definition as FeatureDefinition), name })
);

// `requires` is an ordering statement, so a feature must appear after everything it names. This
// runs at import: a barrel that contradicts itself is a programming error, not a runtime
// condition, and the cost of finding out later is a feature silently augmenting a config its
// dependency has not touched yet.
featureList.forEach((feature, index) => {
  for (const required of feature.requires) {
    const position = featureList.findIndex((f) => f.name === required);

    if (position === -1) {
      throw new Error(`Feature "${feature.name}" requires "${required}", which is not registered`);
    }
    if (position > index) {
      throw new Error(
        `Feature "${feature.name}" requires "${required}", so it must be exported after it in ` +
          `core/features/registry.ts`
      );
    }
  }
});

/** The features that apply to one prototype, in barrel order. */
export const featuresFor = (prototype: PrototypeName): RegisteredFeature[] =>
  featureList.filter((feature) => feature.extends.includes(prototype));

/**
 * Runs every applicable feature's `augment` over a prototype config.
 *
 * Called from the four prototype factories in place of the hand-written `augmentX(...)` chain.
 *
 * **The overloads are not decoration.** Two augments do more than append fields — they *narrow*
 * the config: `upload` and `versions` each turn an author's `true` into a normalised object, and
 * the factories' return types depend on that having happened (`BuiltCollection.versions` is
 * `Required<VersionsConfig>`, not `boolean`). A runtime reduce cannot infer it, so it is declared
 * here, once, per prototype. One line per normalising feature is the honest cost — and the day an
 * augment stops normalising, its line goes.
 *
 * Worth noting what that reveals: normalising author input is config-factory work, not feature
 * work. An augment that only appended fields would need no overload at all.
 */
export function augmentWithFeatures<T extends Dic>(
  config: T,
  prototype: 'collection'
): WithNormalizedUpload<WithVersionsConfig<T>>;
export function augmentWithFeatures<T extends Dic>(
  config: T,
  prototype: 'area'
): WithVersionsConfig<T>;
export function augmentWithFeatures<T extends Dic>(config: T, prototype: PrototypeName): Dic {
  // The cast inside is the registry's usual one: each augment preserves the shape it is handed,
  // but a list holding augments for more than one prototype kind cannot say so.
  return featuresFor(prototype).reduce(
    (current, feature) =>
      feature.augment && feature.enabled(current) ? (feature.augment(current) as T) : current,
    config
  );
}

/**
 * One feature's hooks for one timing, or nothing when this config does not use the feature.
 *
 * Spread at the position the pipeline chooses — the feature says *what* runs and *whether*, the
 * pipeline says *where*.
 */
export const featureHooks = (
  feature: FeatureDefinition,
  config: Dic,
  timing: HookTiming
): AnyHook[] => {
  if (!feature.enabled(config)) return [];
  return feature.hooks?.[timing] || [];
};

/**
 * Runs every feature's `configure` over the whole config, in barrel order.
 *
 * Unlike `augmentWithFeatures` this needs no per-prototype overload: a `configure` adds
 * collections, it does not narrow the config's type.
 */
export const configureWithFeatures = <T extends Dic>(config: T): T =>
  featureList.reduce(
    (current, feature) => (feature.configure ? (feature.configure(current) as T) : current),
    config
  );

/**
 * Runs every feature's boot step, in barrel order.
 *
 * The one place the doc's `for (const feature of features)` shape is straightforwardly right:
 * boot steps have no core steps to interleave with, so `requires` — already checked against this
 * order above — is the only ordering that matters.
 */
export const bootFeatures = async (config: Dic): Promise<void> => {
  for (const feature of featureList) {
    await feature.boot?.(config);
  }
};

/**
 * Every active feature's hooks for one timing, in barrel order.
 *
 * What replaces the pipeline spelling out `...featureHooks(upload, collection, 'beforeRead')` per
 * feature. A prototype asks the registry for "whatever extends me at this timing" and never
 * learns which features answered — which is the whole point of the layer.
 */
export const featureHooksFor = (
  prototype: PrototypeName,
  config: Dic,
  timing: HookTiming
): AnyHook[] => featuresFor(prototype).flatMap((feature) => featureHooks(feature, config, timing));
