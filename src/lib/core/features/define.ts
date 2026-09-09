import type { Dic } from '$lib/util/types.js';
import type { DocTypeContribution } from './doc-type.js';

/**
 * A feature **augments and extends** what a prototype defines.
 *
 * The middle of the three layers — a prototype *defines* the base thing, a feature augments and
 * extends it at large scale (across prototypes, adding version tables and children), a plugin augments
 * at small scale. See docs/architecture-target.md.
 *
 * What a feature owns is its whole vertical: the fields it adds to a config, the hooks that make
 * those fields mean something, and (for `versions`/`child`) the tables it asks the adapter for.
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
   * What this feature adds to a prototype's **generated document type** — see `doc-type.ts`.
   *
   * The type-generation twin of `columns`: that one says what the prototype's row carries, this
   * says what a consumer's `PagesDoc` carries. Both are per-prototype and both fold gated by
   * `enabled`.
   */
  docType?: (config: any) => DocTypeContribution;

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
   * What this feature takes off, or adds to, a blank document.
   *
   * Folded over the features a config enables, in the prototype's order, on the result of
   * `createBlankDocument` — so a feature shapes it without `prototype/doc.ts` knowing any feature
   * exists. `auth` strips its private members; `versions` publishes the bootstrapped first row.
   *
   * `intent` says which blank this is, the way `readQuery`'s does. `'create'` is what an author's
   * create starts from, so it takes the field defaults; `'seed'` is the row `boot` writes when a
   * singleton has none yet, and it is the exception to them. `versions` defaults `status` to
   * `draft`, right for every version an author makes and wrong for the very first one — a
   * bootstrapped area whose only row is a draft reads as absent, since a default read narrows to
   * the published one. That rule was `if (config.versions?.draft) mainData.status = PUBLISHED`
   * inside the adapter's `ensurePrototypeExists`, the database layer applying a feature's rule to
   * a row it inserts.
   *
   * This was two seams and two folds, `blank` and `seed`, with one implementer each. The API's
   * `blank()` and boot's seed are the only callers; the blank `merge-with-blank` builds for a
   * write is deliberately unfiltered, since a create has to null those members out rather than
   * omit them.
   */
  blank?: (doc: any, config: any, intent: BlankIntent) => any;
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
/** Which blank a feature is being asked to shape — see `FeatureDefinition.blank`. */
export type BlankIntent = 'create' | 'seed';

export type WritePlan = {
  /** What goes on the prototype's own row. */
  data: Dic;
  /**
   * The content row this write also touches, when it is not the base row.
   *
   * `id` is absent on an **insert**, where there is no row yet: the adapter creates it and answers
   * with its id. Present on an update, which names the row it means.
   */
  content?: { id?: string; data: Dic };
};

/**
 * A versions table, as the feature that owns it describes it.
 *
 * Only `slug` for now, and deliberately: it is what the schema needs, and an unread member is
 * exactly the mistake this declaration replaces. The read selector and the owner column join it
 * when there is something reading them (docs/decoupling.md § 4.4).
 */
export type VersionsTable = {
  /**
   * The versions's own slug — `$pages__versions`. In slug space, never a table name: what a slug
   * is called in the database is the adapter's business, and it maps.
   */
  slug: string;
};

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
