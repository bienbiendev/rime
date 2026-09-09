import type { Dic } from '$lib/util/types.js';
import type { OperationQuery, ReadIntent } from '$lib/core/pipeline/types.js';
import type { DocTypeContribution } from './doc-type.js';
import type { ColumnDeclaration, TableDeclaration } from './tables.js';

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
   * Tables this feature needs that no prototype declares.
   *
   * `shadow` above deviates a prototype's own table; this is for storage that belongs to the
   * feature itself — better-auth's four tables, an api-key store. They were drizzle source inside
   * `adapter-sqlite/generate-schema/templates.server.ts`, emitted unconditionally, which is how the
   * schema generator came to import a feature's vocabulary.
   *
   * Asked of the **whole** config, once, because these are not per-prototype. Which is why it is
   * folded **ungated**: `enabled` is written against a prototype config and would answer the wrong
   * question here. A feature returns `[]` for a config that does not use it — auth checks whether
   * any collection declares `auth`, which is the same test `enabled` makes, asked at the right
   * scope.
   */
  tables?: (config: any) => TableDeclaration[];

  /**
   * What this feature adds to a prototype's **generated document type** — see `doc-type.ts`.
   *
   * The type-generation twin of `columns`: that one says what the prototype's row carries, this
   * says what a consumer's `PagesDoc` carries. Both are per-prototype and both fold gated by
   * `enabled`.
   */
  docType?: (config: any) => DocTypeContribution;

  /**
   * Columns this feature adds to a **prototype's** table, when that prototype enables it.
   *
   * Not `augment`, which adds *fields* — things a document has, that a form writes and the
   * pipeline validates. This is storage only: a foreign key into one of the feature's own tables,
   * a flag no form ever sends. `templateHasAuth` was this, and the `slug === 'staff'` inside it
   * was the schema generator knowing which collection the feature had derived.
   *
   * Folded gated by `enabled`, like `blank`, and appended after the prototype's own columns —
   * field order is column order (`CONTRIBUTING.md`), and these come last.
   */
  columns?: (config: any) => ColumnDeclaration[];

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

  /**
   * Where this feature sends the halves of an update.
   *
   * The default plan puts everything on the prototype's own row. A feature that gives a config a
   * second row to write — a shadow — refines the plan to say which half lands where, and the
   * adapter then writes exactly what it is handed.
   *
   * Folded in the prototype's feature order, gated by `enabled`, at a fixed point in `runUpdate`:
   * after every data hook, before the write. **Not a hook**, deliberately. A hook could not be
   * guaranteed last — a consumer's `beforeUpdate` hook declares `requires: [HOOK_MARKS.VALIDATED]` and
   * provides nothing, so there is no mark a plan step could wait on, and a consumer hook that
   * rewrote `data` would be silently split around.
   *
   * This is what `versionOperation` used to be for: the operation passed the enum down and the
   * adapter decoded it into three branches. The branches were never about the database — they were
   * about which rows this write touches, which is what a plan says.
   *
   * `operation` is there because the two are not the same plan. An update names the content row
   * it writes; an insert has no row to name yet, so it names the half and the adapter makes the
   * row. Without it a feature would have to infer which it is from a context member being absent,
   * which is how `versionOperation` came to travel to the adapter in the first place.
   *
   * `any` for the config and context, like `validate` and `blank` above: this file is the seam
   * every feature is declared against, and typing them would have it import the pipeline and the
   * config, which is the coupling the seam exists to avoid. Each feature narrows its own.
   */
  writePlan?: (
    plan: WritePlan,
    args: { config: any; context: any; operation: 'create' | 'update' }
  ) => WritePlan;

  /**
   * How this feature narrows *which* content row a read means.
   *
   * A prototype with a shadow has more than one row that could answer a read, and the difference
   * between them is the feature's own — a status, a revision the caller named. So the feature
   * returns the filter, as an ordinary `OperationQuery`, and the adapter applies it to the shadow
   * along with everything else it was asked to filter by.
   *
   * `undefined` means "no narrowing", which the adapter reads as the newest content row. That is
   * not a policy sneaking back in: it is what "the content of this document" means when nobody
   * said otherwise, the same statement as `updatedAt` being the default sort.
   *
   * First answer wins, like `shadow` — a config has one content row, so it has one rule for
   * picking it.
   *
   * This is what `draft` and `versionId` used to be on the adapter contract. They were request
   * parameters the database layer decoded, using `config.versions.draft` to know whether the
   * status column even existed; the caller knows both, so the caller says it.
   *
   * `intent` is there because the same parameters can mean different rows depending on why the
   * read is happening — see `ReadIntent`. Core states the two intents because both exist for every
   * prototype; only a feature can say what each one selects.
   */
  readQuery?: (args: {
    config: any;
    params: { draft?: boolean; versionId?: string };
    intent: ReadIntent;
  }) => OperationQuery | undefined;
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
 * A shadow table, as the feature that owns it describes it.
 *
 * Only `slug` for now, and deliberately: it is what the schema needs, and an unread member is
 * exactly the mistake this declaration replaces. The read selector and the owner column join it
 * when there is something reading them (docs/decoupling.md § 4.4).
 */
export type ShadowDeclaration = {
  /**
   * The shadow's own slug — `$pages__versions`. In slug space, never a table name: what a slug
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
