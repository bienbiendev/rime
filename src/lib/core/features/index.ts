import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';
import type { Hook, HookBeforeOperation, Operation } from '$lib/core/operations/types.js';

/**
 * A feature's runtime hooks, keyed by timing — never ordered.
 *
 * The keys mirror the `Hooks.*` factory in factory/hooks.ts, so a hook written with
 * `Hooks.beforeUpsert(...)` is declared under `beforeUpsert` and is placeable in both the
 * beforeCreate and beforeUpdate arrays. The nesting exists for one reason: it makes the timing
 * **checkable**. A flat `Record<string, unknown>` map accepted a beforeRead hook that
 * pipeline.server.ts then placed in afterDelete, with no error anywhere.
 *
 * What this deliberately does NOT do is order them. Within a timing the map is unordered, and
 * pipeline.server.ts still names each hook and picks its position by hand — because the order
 * interleaves *across* features (in beforeRead, upload's populateSizes sits between core's
 * setDocumentType and url's populateURL), which no feature can state about itself.
 */
export type FeatureHooks = {
  beforeOperation?: Record<string, HookBeforeOperation<any, Operation>>;
  beforeRead?: Record<string, Hook<any, 'read', 'before'>>;
  beforeCreate?: Record<string, Hook<any, 'create', 'before'>>;
  beforeUpsert?: Record<string, Hook<any, 'create' | 'update', 'before'>>;
  beforeUpdate?: Record<string, Hook<any, 'update', 'before'>>;
  beforeDelete?: Record<string, Hook<any, 'delete', 'before'>>;
  afterCreate?: Record<string, Hook<any, 'create', 'after'>>;
  afterUpsert?: Record<string, Hook<any, 'create' | 'update', 'after'>>;
  afterUpdate?: Record<string, Hook<any, 'update', 'after'>>;
  afterDelete?: Record<string, Hook<any, 'delete', 'after'>>;
};

/**
 * What a feature contributes, and to which of the three phases.
 *
 * Sibling to `Plugin` (core/plugins/index.ts) and `FieldBuilder` (core/fields/builders/): a
 * plugin extends the app, a field extends a document, a **feature extends a prototype** — it is
 * switched on by a key the config author writes on a collection or an area (`upload: {…}`,
 * `$url: …`), and it contributes at the phase or phases it needs.
 *
 * Read docs/structure-audit.md §§12–17 for how this was arrived at. Two constraints from there
 * are baked into the shape and must not be designed away:
 *
 * 1. **A feature declares; a layer orders.** `hooks` is a *named map*, never an ordered list.
 *    operations/pipeline.server.ts still spells out the sequence by hand, because ordering is
 *    the interesting part of a pipeline and a loop over a registry would hide it. Same for
 *    `boot`, which is placed by boot.server.ts.
 * 2. **Nothing here may be iterated to build a config.** The augment chain in factory/ stays a
 *    literal `const withX = …` sequence: it is what carries a user's collection and area slug
 *    *literals* all the way to `event.locals.rime`, and a reduce over an array widens them to
 *    `string`. factory/config/inference.spec.ts fails if that happens.
 *
 * The member types are deliberately loose (`(config: any) => any`). `defineFeature` captures the
 * precise signature of whatever is assigned, so `upload.augment.server(config)` keeps
 * `augmentUploadServer`'s exact generic return type — the loose type only says which seams
 * exist, it never becomes the type a caller sees.
 */
export type Feature = {
  name: string;

  /** Which prototypes this feature can be switched on for. */
  appliesTo: readonly ('collection' | 'area')[];

  /**
   * Is this feature on for this prototype? The one definition of the test that
   * pipeline.server.ts and the factories otherwise each spell out inline.
   */
  enabled: (config: BuiltCollection | BuiltArea | any) => boolean;

  /** Phase 2 (boot) — shapes the authored config. Two sides, declared as a pair so the client
   *  and server variants of a feature can never silently drift apart. */
  augment?: {
    client?: (config: any) => any;
    server?: (config: any) => any;
  };

  /** Phase 2 (boot) — extra prototypes derived from the config (upload's `<slug>_directories`).
   *  Adapter-agnostic: a derived prototype flows through the normal schema loop. */
  derive?: {
    client?: (config: any) => any;
    server?: (config: any) => any;
  };

  /** Phase 2 (boot) — a once-per-process side effect. Placed by boot.server.ts. */
  boot?: (config: any) => void | Promise<void>;

  /** Phase 3 (runtime) — keyed by timing, named within it, NOT ordered. Placed by
   *  operations/pipeline.server.ts. See FeatureHooks above. */
  hooks?: FeatureHooks;
};

/**
 * Identity, exactly like `definePlugin`. The `const F extends Feature` pair is load-bearing:
 * `extends Feature` checks the shape, `const F` captures the literal types, so a feature object
 * constrains without widening any of the generic functions it holds.
 */
export function defineFeature<const F extends Feature>(feature: F): F {
  return feature;
}
