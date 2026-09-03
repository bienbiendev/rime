import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import type { AnyHook, FeatureDefinition, HookTiming, RegisteredFeature } from './define.js';
import type { ApplyAugments } from './register.js';
import { metas } from './metas/index.js';
import { nested } from './nested/index.js';
import { thumbnail } from './thumbnail/index.js';
import { title } from './title/index.js';
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
 * The last three arrived from `factory/shared/`, where they sat because both prototypes used
 * them — a statement about reuse, not about layer, and reuse is what a feature is for. They come
 * after the field-appending four on purpose: `title` reads the fallback `upload` offers, which is
 * the first genuine `requires` in this registry.
 *
 * Not every feature has moved here yet. `versions` is registered for its augment only (see its
 * definition), and the block/tree/relation children are still loose. `auth` is not a feature at
 * all — docs/architecture-target.md settles that: it is core.
 */
const features = { upload, nested, versions, url, metas, title, thumbnail };

export { metas, nested, thumbnail, title, upload, url, versions };

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
 * The order each prototype's augments apply in, at the type level.
 *
 * A list rather than a set, and per prototype rather than one shared: `thumbnail` extends only
 * collections, so folding it over an area would give an area an `asThumbnail` it never gets. The
 * runtime check below keeps these honest against each feature's own `extends`.
 *
 * These name features, which the registry is entitled to do — it is the registry. What it no
 * longer names is their *types*: each transform is declared beside its own feature through
 * `FeatureConfigAugment` (see register.ts).
 */
type CollectionAugments = ['upload', 'nested', 'versions', 'url', 'metas', 'title', 'thumbnail'];
type AreaAugments = ['versions', 'url', 'metas', 'title'];

// Two orderings for one fact, so they are checked rather than trusted: a feature added to the
// barrel without a matching entry here would silently lose its type transform, which is the
// quiet half of the same bug the pipeline's golden order exists to catch.
const declaredOrder: Record<PrototypeName, readonly string[]> = {
  collection: ['upload', 'nested', 'versions', 'url', 'metas', 'title', 'thumbnail'],
  area: ['versions', 'url', 'metas', 'title']
};

for (const [prototype, order] of Object.entries(declaredOrder)) {
  const actual = featuresFor(prototype as PrototypeName).map((feature) => feature.name);
  if (actual.join() !== order.join()) {
    throw new Error(
      `core/features/registry.ts: the ${prototype} augment order declared for the type fold ` +
        `(${order.join(', ')}) does not match the barrel (${actual.join(', ')}).`
    );
  }
}

/**
 * Runs every applicable feature's `augment` over a prototype config.
 *
 * Called from each prototype's config factory in place of the hand-written `augmentX(...)` chain.
 *
 * **The return types are not decoration.** Some augments do more than append fields — they
 * *narrow* the config, and the factories' return types depend on that having happened
 * (`BuiltCollection.versions` is `Required<VersionsConfig>`, not `boolean`; `asTitle` is a
 * required `string`). A runtime reduce cannot infer any of it, so it is declared — but by each
 * feature, about itself, rather than here about them.
 */
export function augmentWithFeatures<T extends Dic>(
  config: T,
  prototype: 'collection'
): ApplyAugments<T, CollectionAugments>;
export function augmentWithFeatures<T extends Dic>(
  config: T,
  prototype: 'area'
): ApplyAugments<T, AreaAugments>;
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
