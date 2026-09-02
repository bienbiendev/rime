import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import type { AnyHook, FeatureDefinition, HookTiming, RegisteredFeature } from './define.js';
import { url } from './url/index.js';

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
 * Not every feature has moved here yet. `versions`, `upload`, `nested` and the block/tree/relation
 * children still live as loose augments and hooks; each converts on its own. `auth` is not a
 * feature at all — docs/architecture-target.md settles that: it is core.
 */
const features = { url };

export { url };

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
 * The cast is the registry's usual one: each augment preserves the shape it is handed, but a list
 * that holds augments for more than one prototype kind cannot say so.
 */
export const augmentWithFeatures = <T extends Dic>(config: T, prototype: PrototypeName): T =>
  featuresFor(prototype).reduce(
    (current, feature) =>
      feature.augment && feature.enabled(current) ? (feature.augment(current) as T) : current,
    config
  );

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
): AnyHook[] => (feature.enabled(config) ? feature.hooks?.[timing] || [] : []);
