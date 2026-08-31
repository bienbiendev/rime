import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';

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

  /** Phase 3 (runtime) — named, NOT ordered. Placed by operations/pipeline.server.ts. */
  hooks?: Record<string, unknown>;
};

/**
 * Identity, exactly like `definePlugin`. The `const F extends Feature` pair is load-bearing:
 * `extends Feature` checks the shape, `const F` captures the literal types, so a feature object
 * constrains without widening any of the generic functions it holds.
 */
export function defineFeature<const F extends Feature>(feature: F): F {
  return feature;
}
