import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { ShadowDeclaration } from '$lib/core/features/define.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type {
  GenericBlock,
  GenericDoc,
  PrototypeSlug,
  RawDoc,
  TreeBlock
} from '$lib/core/prototype/types.js';
import type { BeforeOperationRelation, Relation } from '$lib/fields/relation/index.js';
import type { DeepPartial, Dic, WithOptional, WithRequired } from '$lib/util/types.js';

/**
 * What core requires of a database adapter.
 *
 * Written here, in core's vocabulary, rather than read off an implementation: an interface
 * inferred from what one adapter returns is not something a second adapter can conform to.
 *
 * The rule that decides what may appear below: **every argument and return type is something core
 * can name**. Slugs, documents, blocks, relations, queries, locales. No tables, no columns, no
 * drizzle. A method that cannot be phrased that way is work on the wrong side of the line — a
 * parameter like `parentSlug: TableName`, naming a slug and carrying a table, is the tell.
 *
 * The escape hatch is deliberately **not** here. `rime.adapter.db` is documented for consumers
 * who need to drop to SQL, and adapter-sqlite still exposes it; core is what must not use it.
 * See `SqliteAdapter` in adapter-sqlite/index.server.ts for the full concrete surface.
 */
export interface Adapter {
  /**
   * Register a prototype. Boot only — see core/boot.server.ts.
   *
   * The adapter resolves its base, shadow, children and branches once here, rather than working
   * them out from a slug on every request, and refuses loudly if the tables are not there.
   */
  registerPrototype(args: RegisterPrototypeArgs): void;

  /** The handle for a registered prototype. */
  prototype(slug: string): PrototypeHandle;

  /**
   * The handle for a table a feature declared — see `FeatureDefinition.tables`.
   *
   * Separate from `prototype` because a declared table is not one: no fields, no pipeline, no
   * access rules, nothing to merge a blank into. Passing one to `prototype()` would ask the
   * adapter to look up a config that does not exist.
   *
   * Deliberately three verbs and a flat filter. A feature that declares a table already knows its
   * columns, so there is nothing here to resolve against a config — which is the whole difference
   * between this and `PrototypeHandle`, and the reason this can stay small.
   */
  table(slug: string): TableHandle;

  blocks: BlocksAdapter;
  tree: TreeAdapter;
  relations: RelationsAdapter;
  transform: TransformAdapter;
  auth: AuthAdapter;
}

export type RegisterPrototypeArgs = {
  config: BuiltArea | BuiltCollection;
  /**
   * Where this config's content lives, when it does not live on the config's own row.
   *
   * Answered by whichever feature deviates it — `versions` today — and folded by `shadowOf` in
   * `core/features/registry.ts`, so boot hands the adapter an answer rather than the adapter
   * working one out. It used to derive the table by appending a suffix to the slug, which meant
   * the database layer knew a feature's naming convention and could only ever know that one.
   *
   * `undefined` means the content is on the base row. The declaration carries a slug, not a table
   * name: how a slug is spelled in the database stays the adapter's business.
   */
  shadow?: ShadowDeclaration;
  /**
   * Whether this prototype holds exactly one document.
   *
   * The only shape fact the adapter needs, and it is about the *data* — how many rows — not
   * about a kind. It decides whether a read needs an id, and it is what `insert` and `delete`
   * refuse on. The adapter does not know the word "area".
   */
  singleton: boolean;
};

/**
 * What the adapter can do to one registered prototype.
 *
 * A uniform toolbox: find, findMany, insert, update, delete over a base and its shadow. Which of
 * these a caller may actually reach is decided by the prototype definition in core/prototype/,
 * not here — except for the two a singleton refuses outright, which the adapter enforces at the
 * database boundary because that is where the guarantee has to hold.
 */
export interface PrototypeHandle {
  readonly slug: string;
  readonly singleton: boolean;
  readonly config: BuiltArea | BuiltCollection;
  /** What it was registered with — see `RegisterPrototypeArgs.shadow`. */
  readonly shadow?: ShadowDeclaration;

  /**
   * One document, merged with the version it should show. `undefined` when nothing matches —
   * the caller decides whether that is a 404.
   *
   * `id` is required to mean anything on a non-singleton, and ignored on a singleton, which has
   * only one row to return.
   */
  find(args?: {
    id?: string;
    select?: string[];
    locale?: string;
    /**
     * Narrows which content row this read means, for a prototype that has one. The newest when
     * omitted, which is what "the content of this document" means with nothing else said.
     *
     * This is what `draft` and `versionId` were. They were request parameters the adapter decoded
     * against `config.versions.draft`; the caller decodes them now
     * (`FeatureDefinition.readQuery`) and hands down a filter, so the adapter applies one rather
     * than choosing one.
     */
    content?: OperationQuery;
  }): Promise<RawDoc | undefined>;

  findMany(args?: {
    select?: string[];
    query?: OperationQuery;
    sort?: string;
    limit?: number;
    offset?: number;
    locale?: string;
    /** Per document, which content row — see `find`. Filters the list as well as picking rows. */
    content?: OperationQuery;
  }): Promise<RawDoc[]>;

  /**
   * Throws on a singleton: there is no second document to make.
   *
   * Returns the document's id and `contentId` — the row its content landed on, which is what its
   * blocks, tree nodes and relations hang off. The two are the same when the prototype has no
   * shadow.
   */
  insert(args: {
    data: DeepPartial<GenericDoc>;
    locale?: string;
  }): Promise<{ id: string; contentId: string }>;

  /**
   * Writes the rows a `WritePlan` names: the prototype's own row always, and the content row when
   * the caller names one.
   *
   * `id` is required on a non-singleton; a singleton resolves its own row.
   *
   * There is no `versionOperation` and no `versionId` here any more. The caller decided which rows
   * this write touches before calling — `core/pipeline/run.server.ts` builds the plan, and
   * `FeatureDefinition.writePlan` is where a feature says its half — so the adapter has a plan to
   * execute rather than an enum to decode into three branches.
   */
  update(args: {
    id?: string;
    data: Dic;
    content?: { id: string; data: Dic };
    locale?: string;
  }): Promise<{ id: string }>;

  /**
   * Sets columns on every row this prototype owns that `query` matches.
   *
   * The bulk half of `update`: no pipeline, no children, and it writes exactly the columns given
   * — `updatedAt` included only if the caller passes it. For a filter that names many rows and a
   * patch that names one column, which `update` cannot express without a read and a write per row.
   *
   * With `locale`, a localized column lands on the localized half instead. The caller names a
   * field and a locale; which table that is, is the adapter's business.
   */
  updateWhere(args: { query: OperationQuery; data: Dic; locale?: string }): Promise<void>;

  /** Throws on a singleton: removing the only document leaves nothing to read. */
  delete(args: { id: string }): Promise<string | undefined>;

  /** Boot only. Writes the row if absent; a no-op if not. */
  ensureExists(args: { blank: Dic; locale?: string }): Promise<void>;
}

/**
 * `parentSlug` is the slug that owns the children — the prototype's shadow when it has one, the
 * prototype itself when not. `pipeline/run.server.ts` resolves it off `PrototypeHandle.shadow`,
 * which is what registration was handed; nothing works it out from a config member.
 */
export interface BlocksAdapter {
  create(args: {
    parentSlug: PrototypeSlug;
    block: WithOptional<GenericBlock, 'id'>;
    ownerId: string;
    locale?: string;
  }): Promise<boolean>;
  update(args: {
    parentSlug: PrototypeSlug;
    block: GenericBlock;
    locale?: string;
  }): Promise<boolean>;
  delete(args: { parentSlug: PrototypeSlug; block: GenericBlock }): Promise<boolean>;
}

export interface TreeAdapter {
  create(args: {
    parentSlug: PrototypeSlug;
    block: WithOptional<WithRequired<TreeBlock, 'path'>, 'id'>;
    ownerId: string;
    locale?: string;
  }): Promise<boolean>;
  update(args: {
    parentSlug: PrototypeSlug;
    block: WithRequired<TreeBlock, 'path'>;
    locale?: string;
  }): Promise<boolean>;
  delete(args: {
    parentSlug: PrototypeSlug;
    block: WithRequired<TreeBlock, 'path'>;
  }): Promise<boolean>;
}

export interface RelationsAdapter {
  create(args: {
    parentSlug: PrototypeSlug;
    ownerId: string;
    relations: BeforeOperationRelation[];
  }): Promise<boolean>;
  update(args: { parentSlug: PrototypeSlug; relations: Relation[] }): Promise<boolean>;
  delete(args: { parentSlug: PrototypeSlug; relations: Relation[] }): Promise<boolean>;
  deleteFromPaths(args: {
    parentSlug: PrototypeSlug;
    ownerId: string;
    paths: string[];
    locale?: string;
  }): Promise<boolean>;
  getAll(args: {
    parentSlug: PrototypeSlug;
    ownerId: string;
    locale?: string;
  }): Promise<Relation[]>;
}

export interface TransformAdapter {
  /**
   * The rows one document is stored across, unflattened and grouped by what they are.
   *
   * This used to return the finished document, which meant the database layer merged the blank,
   * decided which bookkeeping to keep, assembled relations into document properties, and read a
   * route parameter to work out who was asking. None of that needs a table. What does: resolving
   * which tables hang off this document, merging each locales branch, and turning column names
   * back into document paths — so that is all this does now. `buildDocument` in
   * `core/pipeline/build-document.server.ts` takes it from here.
   */
  rows(args: { doc: RawDoc; slug: PrototypeSlug; locale?: string }): Promise<DocumentRows>;
}

/**
 * One document's storage rows, in core's vocabulary. No table names leave the adapter.
 */
export type DocumentRows = {
  /**
   * The document's own columns: flat, keyed by document path, with the locales branch merged in
   * and every child table's key removed.
   *
   * Flat because the column-to-path rule (`__` separates path segments) is the adapter's, and
   * applying it needs the flattened keys. Core unflattens once, at the end.
   */
  base: Dic;
  /** Block rows, keyed by document path, each carrying its own `path`, `position` and `type`. */
  blocks: Dic[];
  /** Tree rows, same shape, ordered by `path`. */
  tree: Dic[];
  /**
   * Junction rows, each with `relationTo` and `documentId` resolved off whichever foreign key
   * column was set. A row with neither is an orphan; core warns and drops it.
   */
  relations: Dic[];
};

/**
 * Read and write one table a feature declared.
 *
 * `where` is a flat map of column to value, ANDed. Not `OperationQuery`: that resolves paths
 * against a prototype's fields, handles localized columns and relation properties, and a declared
 * table has none of those. A feature that declared a table knows its columns, so there is nothing
 * to resolve.
 *
 * `update` and `delete` **refuse an empty `where`**. A filter that matches everything is never
 * what a caller meant, and drizzle's `and()` of nothing is `undefined`, which is a statement with
 * no `WHERE` clause at all.
 */
export interface TableHandle {
  /** Rows matching every condition, all columns unless `select` names some. */
  find(args?: { where?: Dic; select?: string[]; limit?: number }): Promise<Dic[]>;
  update(args: { where: Dic; data: Dic }): Promise<void>;
  delete(args: { where: Dic }): Promise<void>;
}

/**
 * What is left of a whole facade that existed for one feature.
 *
 * Six methods went. Three — `isSuperAdmin`, `getBetterAuthUserId`, `getUserAttributes` — were each
 * `select … from <a prototype's table> where <a column> = ?`, which is `prototype(slug).findMany`;
 * they looked like adapter work only because all three named a collection called `staff`. The
 * other three read and wrote Better-auth's own tables, which are declared tables now, so
 * `table(slug)` reaches them.
 *
 * **Better-auth's admin API cannot replace those three**, which `docs/decoupling-auth.md` § 2.2
 * left open. `listUsers`, `setRole` and `removeUser` all sit behind `adminMiddleware`, and every
 * caller here runs where no admin session exists: `hasAuthUser` gates the init route, which only
 * runs when there is no user at all; `setAuthUserRole` promotes the very first signup; and
 * `deleteAuthUser` rolls back a failed signup, which `removeUser` refuses outright with
 * `YOU_CANNOT_REMOVE_YOURSELF`.
 */
export interface AuthAdapter {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
}
