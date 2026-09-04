import type { Handle } from '@sveltejs/kit';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import type { Dic } from '$lib/util/types.js';

/**
 * A feature **augments and extends** what a prototype defines.
 *
 * The middle of the three layers — a prototype *defines* the base thing, a feature augments and
 * extends it at large scale (across prototypes, adding shadows and children), a plugin augments
 * at small scale. See docs/architecture-target.md.
 *
 * What a feature owns is its whole vertical: the fields it adds to a config, the hooks that make
 * those fields mean something, and (for `shadow`/`child`) the tables it asks the adapter for.
 * What it does *not* own is where its document hooks sit in the pipeline — see `hooks` below.
 *
 * Only the members some feature here actually uses are declared. `beforeBoot`, `afterBoot`,
 * `beforeCodegen`, `afterCodegen`, `persistence` and `transform` land when a feature needs them.
 */
export type FeatureDefinition = {
  /**
   * Identifies the feature in the generated pipeline, and deduplicates the whole-config steps
   * (`configure`, `boot`, `handler`) when several prototypes list the same one.
   *
   * Declared rather than inferred: a prototype lists its features by value, and an argument has
   * no name of its own.
   */
  name: string;

  /**
   * What the feature does to the database, which is what tells the adapter whether to generate
   * anything for it:
   *
   * - `augment` — no tables of its own; it only changes a config. The adapter never hears of it.
   * - `shadow` — deviates the prototype's own table (`{base}__versions`).
   * - `child` — a table owned by the prototype's rows (`{base}__$relations`).
   */
  type: 'augment' | 'shadow' | 'child';

  /**
   * Features this one is built on top of, by name.
   *
   * Also an ordering statement: a feature runs after everything it requires. `definePrototype`
   * checks this against the order the prototype listed rather than sorting by it, so the order
   * stays readable where it is declared and a list that contradicts a `requires` fails loudly.
   */
  requires: string[];

  /**
   * Whether a given config uses this feature — the one place that question is answered, for its
   * augment and its hooks alike.
   */
  enabled: (config: Dic) => boolean;

  /**
   * What the feature adds to a config of a prototype it extends — fields, mostly.
   *
   * Runs inside the prototype factories, in barrel order, only for configs where `enabled`.
   *
   * `any` rather than `Dic`: each augment names the shape it needs (`{ slug, nested?, fields? }`,
   * `Collection<any>`), and a parameter is contravariant, so a list accepting every feature's
   * augment cannot promise any of them a shape. Sound because an augment only ever sees configs of
   * a prototype that lists it. What it does to the config's *type* is declared in register.ts.
   */
  augment?: (config: any) => any;

  /**
   * What the feature adds to the **whole** config rather than to one prototype's: auth adds the
   * `staff` collection, upload derives a `<slug>Directories` companion per upload collection, the
   * panel fills in its defaults, cors defaults the origin list.
   *
   * Runs through `configureWithFeatures` in the config chain. What it does to the config's *type*
   * is declared in register.ts.
   *
   * **The prototypes come as an argument so that a feature never imports one.** A step deriving a
   * prototype config needs that prototype's `features` to build its hooks; importing the
   * definition for them closes the cycle a definition's own feature list creates, and the feature
   * still evaluating comes out `undefined` in it.
   */
  configure?: (config: any, prototypes: RegisteredPrototype[]) => any;

  /**
   * A SvelteKit `Handle` the feature contributes to the request pipeline, collected by
   * `handlers/index.ts` and run between `handleAuth` and the plugins'.
   *
   * The layer under `hooks` below: this is where there is no document yet. `cors` enforces its
   * origin list here, per request rather than per document.
   */
  handler?: Handle;

  /**
   * Run once per process, before anything is served — the feature's own boot step.
   *
   * Takes the whole config, not one prototype's, which is why it is not a timing in `hooks`: it
   * answers a question about the config as a whole ("does anything here upload?"). Mirrors
   * `PrototypeDefinition.boot`.
   */
  boot?: (config: any) => void | Promise<void>;

  /**
   * The feature's document hooks, by timing.
   *
   * The feature owns the implementations; it does not own where they run. Each hook declares
   * `requires`/`provides` (see core/pipeline/hooks.ts) and `resolve-pipeline.server.ts` sorts
   * them, which is what a written-out list cannot do: in a collection's `beforeRead` a feature's
   * hooks interleave with core steps — `populateURL` runs after the document is shaped and before
   * it is sorted — while the features interleaving there require nothing of *each other*.
   */
  hooks?: FeatureHooks;
};

export type FeatureHooks = Partial<Record<HookTiming, AnyHook[]>>;

export type HookTiming =
  | 'beforeOperation'
  | 'beforeRead'
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete';

/**
 * A hook as the registry holds it. Each timing has its own argument shape (see
 * core/pipeline/hooks.ts), which a list covering every timing cannot express — the same erasure the prototype registry
 * makes, and sound for the same reason: a hook only ever reaches the timing it is declared under.
 */
export type AnyHook = (args: any) => any;

/** Alias for call sites that read better naming the registered thing. */
export type RegisteredFeature = FeatureDefinition;

/**
 * Generic in the *name only*, so `name` survives as a literal and a prototype's `features` list
 * yields an ordered tuple of names for the type fold.
 *
 * Not `<const D extends FeatureDefinition>`: that would also freeze every array literal in the
 * definition into a fixed-length tuple, so `hooks.beforeRead` would type as `[Hook]` and refuse a
 * plain `Hook[]`.
 */
export const defineFeature = <N extends string>(
  definition: FeatureDefinition & { name: N }
): FeatureDefinition & { name: N } => definition;
