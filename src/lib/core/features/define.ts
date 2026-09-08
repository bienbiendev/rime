import type { Handle } from '@sveltejs/kit';
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
   * - `shadow` — deviates the prototype's own table. Declared by `shadow` below.
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
   * The table this feature deviates a config's content into, or `undefined` when it deviates
   * nothing.
   *
   * A **shadow** stands in for the config's own table: the base row keeps its identity, its
   * timestamps and whatever fields are marked `._root()`, and every other column — plus the whole
   * subtree of children hanging off them — moves onto the shadow. Which is why the answer is one
   * slug: name the row that owns the content and everything downstream follows.
   *
   * Asked of a config, not of a kind, and only for configs where `enabled` — so a prototype with
   * versions on one collection and not the next gets a shadow for the first alone.
   *
   * This is what makes `type: 'shadow'` mean something: the adapter builds the second table from
   * what is declared here rather than from a member it recognises by name.
   */
  shadow?: (config: any) => ShadowDeclaration | undefined;

  /**
   * What the feature adds to the **whole** config rather than to one prototype's: auth adds the
   * `staff` collection, upload derives a `<slug>Directories` companion per upload collection, the
   * panel fills in its defaults, cors defaults the origin list.
   *
   * Runs through `configureWithFeatures` in the config chain. What it does to the config's *type*
   * is declared in register.ts.
   *
   * A feature must never import a prototype definition to do this: a definition lists its
   * features by value, so a feature reaching back for one can be evaluated from inside it and find
   * whichever feature is still in flight `undefined`. Anything a derived config needs from a
   * prototype — its hooks above all — is applied after this step, not by it.
   */
  configure?: (config: any) => any;

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
   * What this feature requires of a config that uses it, as a list of error messages.
   *
   * Asked of each prototype config the feature extends, and only where `enabled` — so a rule is
   * written about a config that *has* the feature, never guarded by a check for it. An empty list
   * means the config is fine; codegen refuses to write anything for a config that returns any.
   *
   * It exists because these rules were in `config/validate.server.ts`, which had to import
   * `isAuthConfig` to know which collections auth's rules applied to. Core validating a feature's
   * own requirements is the same inversion as core deriving a feature's tables: the feature knows
   * what it needs, so the feature says it.
   */
  validate?: (config: any) => string[];

  /**
   * What this feature takes off, or adds to, the blank document the local API hands out.
   *
   * Folded over the features a config enables, in the prototype's order, on the result of
   * `createBlankDocument` — so a feature shapes the blank document without `prototype/doc.ts`
   * knowing any feature exists. `auth` strips its private members with it.
   *
   * The API's `blank()` only: the blank `merge-with-blank` builds to seed a write is deliberately
   * unfiltered, since a create has to null those members out rather than omit them.
   */
  blank?: (doc: any, config: any) => any;

  /**
   * Where this feature sends the halves of an update.
   *
   * The default plan puts everything on the prototype's own row. A feature that gives a config a
   * second row to write — a shadow — refines the plan to say which half lands where, and the
   * adapter then writes exactly what it is handed.
   *
   * Folded in the prototype's feature order, gated by `enabled`, at a fixed point in `runUpdate`:
   * after every data hook, before the write. **Not a hook**, deliberately. A hook could not be
   * guaranteed last — a consumer's `beforeUpdate` hook declares `requires: ['validated']` and
   * provides nothing, so there is no mark a plan step could wait on, and a consumer hook that
   * rewrote `data` would be silently split around.
   *
   * This is what `versionOperation` used to be for: the operation passed the enum down and the
   * adapter decoded it into three branches. The branches were never about the database — they were
   * about which rows this write touches, which is what a plan says.
   *
   * `any` for the two arguments, like `validate` and `blank` above: this file is the seam every
   * feature is declared against, and typing them would have it import the pipeline and the config,
   * which is the coupling the seam exists to avoid. Each feature narrows its own.
   */
  writePlan?: (plan: WritePlan, args: { config: any; context: any }) => WritePlan;

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

/**
 * Which rows an update writes, and with what.
 *
 * Spreads straight into the adapter's `update` — `update({ id, ...plan, locale })` — so the base
 * half is named `data`, matching what `data` means in every other adapter method.
 *
 * `content` absent means one of two different things, and the adapter does not need to tell them
 * apart: either the prototype has no content row of its own, or it has one that somebody else has
 * already written (a new version, created through the public API before this write). Both come
 * out as "write the base row and stop".
 */
export type WritePlan = {
  /** What goes on the prototype's own row. */
  data: Dic;
  /** The content row this write also touches, when it is not the base row. */
  content?: { id: string; data: Dic };
};

/**
 * A shadow table, as the feature that owns it describes it.
 *
 * Only `slug` for now, and deliberately: it is what the schema needs, and an unread member is
 * exactly the mistake this declaration replaces. The read selector and the owner column join it
 * when there is something reading them (docs/decoupling-versions.md, stages 3-4).
 */
export type ShadowDeclaration = {
  /**
   * The shadow's own slug — `$pages__versions`. In slug space, never a table name: what a slug
   * is called in the database is the adapter's business, and it maps.
   */
  slug: string;
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
