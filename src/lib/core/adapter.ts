import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { GenericBlock, PrototypeSlug, RawDoc, TreeBlock } from '$lib/core/prototype/types.js';
import type { BeforeOperationRelation, Relation } from '$lib/fields/relation/index.js';
import type { Dic, WithOptional, WithRequired } from '$lib/util/types.js';

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
   * The adapter resolves its base, versions, children and branches once here, rather than working
   * them out from a slug on every request, and refuses loudly if the tables are not there.
   */
  registerPrototype(args: RegisterPrototypeArgs): void;

  /** The handle for a registered prototype. */
  collection(slug: string): CollectionHandle;

  /** The handle for a registered area. */
  area(slug: string): AreaHandle;

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

  blocks: BlocksHandle;
  tree: TreeHandle;
  relations: RelationsHandle;
  transform: TransformHandle;
  auth: AuthHandle;
}

export type RegisterPrototypeArgs = {
  config: BuiltArea | BuiltCollection;
  /**
   * Where this config's content lives, when it does not live on the config's own row.
   *
   * Answered by whichever feature deviates it — `versions` today — and folded by `versionsTableOf` in
   * `core/features/registry.ts`, so boot hands the adapter an answer rather than the adapter
   * working one out. It used to derive the table by appending a suffix to the slug, which meant
   * the database layer knew a feature's naming convention and could only ever know that one.
   *
   * `undefined` means the content is on the base row. The declaration carries a slug, not a table
   * name: how a slug is spelled in the database stays the adapter's business.
   */
  versions?: VersionsTable;
};

/**
 * What the adapter can do to one registered prototype.
 *
 * A uniform toolbox: find, findMany, insert, update, delete over a base and its versions. Which of
 * these a caller may actually reach is decided by the prototype definition in core/prototype/,
 * not here — except for the two a singleton refuses outright, which the adapter enforces at the
 * database boundary because that is where the guarantee has to hold.
 */
/**
 * What every prototype handle carries, whatever kind it is.
 *
 * `slug` and `config` are what it was registered with; `versions` is where this config's content
 * lives when that is not its own row.
 */
interface BaseHandle {
  readonly slug: string;
  readonly config: BuiltArea | BuiltCollection;
  /** What it was registered with — see `RegisterPrototypeArgs.versions`. */
  readonly versions?: VersionsTable;

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
}

/**
 * What the adapter can do to one registered **collection**.
 *
 * Many documents, addressed by id: `find`, `update` and `delete` each take one, and `insert` makes
 * a new one. That is the whole difference from an area, and it is said in the type now rather than
 * refused at runtime — `singleton` used to carry it, as `id: singleton ? undefined : args.id` on
 * every read, a `resolveSingletonId()` on every write, and two `refuseOnSingleton` throws nothing
 * ever exercised, because the area *definition* already exposed neither verb.
 */
export interface CollectionHandle extends BaseHandle {
  /**
   * One document, merged with the version it should show. `undefined` when nothing matches — the
   * caller decides whether that is a 404.
   */
  find(args: {
    id: string;
    select?: string[];
    locale?: string;
    /**
     * Narrows which content row this read means, for a config that has one. The newest when
     * omitted, which is what "the content of this document" means with nothing else said.
     *
     * This is what `draft` and `versionId` were. They were request parameters the adapter decoded
     * against `config.versions.draft`; the caller decodes them now (`versionsReadQuery`) and hands
     * down a filter, so the adapter applies one rather than choosing one.
     */
    content?: OperationQuery;
  }): Promise<RawDoc | undefined>;

  /**
   * Makes a document. The difference from `update` is the one an insert has by definition:
   * `content` carries no `id`, because the row does not exist yet — the adapter makes it and
   * answers with it.
   *
   * A versioned config **requires** `content`. Its base row has no columns for the content, so a
   * plan naming no content half would write half a document and hang its blocks off the wrong row;
   * the adapter refuses instead.
   *
   * Returns the document's id and `contentId` — the row its content landed on, which is what its
   * blocks, tree nodes and relations hang off. The two are the same when the config is not
   * versioned.
   */
  insert(args: {
    data: Dic;
    content?: { data: Dic };
    locale?: string;
  }): Promise<{ id: string; contentId: string }>;

  /**
   * Writes the rows a write plan names: the document's own row always, and the content row when
   * the caller names one.
   *
   * There is no `versionOperation` and no `versionId` here. The caller decided which rows this
   * write touches before calling — `pipeline/run.server.ts` builds the plan and
   * `versionsWritePlan` refines it — so the adapter executes a plan rather than decoding an enum
   * into three branches.
   */
  update(args: {
    id: string;
    data: Dic;
    content?: { id: string; data: Dic };
    locale?: string;
  }): Promise<{ id: string }>;

  /** Removes one document. */
  delete(args: { id: string }): Promise<string | undefined>;
}

/**
 * What the adapter can do to one registered **area**.
 *
 * Exactly one document, so nothing here takes an id — the handle resolves which row it is. There
 * is no `insert` and no `delete`: not switched off, absent. `ensureExists` is the consequence, and
 * it is boot's: the row has to be there before a request can read it.
 */
export interface AreaHandle extends BaseHandle {
  /** The document, merged with the version it should show. See `CollectionHandle.find`. */
  find(args?: {
    select?: string[];
    locale?: string;
    content?: OperationQuery;
  }): Promise<RawDoc | undefined>;

  /** Writes the rows a write plan names. See `CollectionHandle.update`. */
  update(args: {
    data: Dic;
    content?: { id: string; data: Dic };
    locale?: string;
  }): Promise<{ id: string }>;

  /** Boot only. Writes the row if absent; a no-op if not. */
  ensureExists(args: { blank: Dic; locale?: string }): Promise<void>;
}

/**
 * `parentSlug` is the slug that owns the children — the prototype's versions when it has one, the
 * prototype itself when not. `pipeline/run.server.ts` resolves it off `PrototypeHandle.versions`,
 * which is what registration was handed; nothing works it out from a config member.
 */
export interface BlocksHandle {
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

export interface TreeHandle {
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

export interface RelationsHandle {
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

export interface TransformHandle {
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
export interface AuthHandle {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
}

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
 * How a feature describes storage it needs, in core's terms.
 *
 * A `versions` deviates a prototype's own table and a prototype's fields become its columns. Neither
 * covers a table that belongs to the **feature** — better-auth's four, an api-key store, an audit
 * log. Those were written out as drizzle source inside the schema generator, which is how the
 * database layer came to know that a collection called `staff` exists and is special.
 *
 * No drizzle here, and no SQL: a declaration says what the storage *is*, and the adapter decides
 * how to spell it. That is the same line `Adapter` draws, for the same reason — a second adapter
 * has to be able to satisfy this.
 */

/**
 * What a column holds.
 *
 * Six values, and deliberately only six: it is what the templates this replaces actually emit, and
 * a wider set is a schema DSL nobody asked for. `timestamp` and `timestampMs` are two entries
 * rather than one because they are two storage formats — epoch seconds and epoch milliseconds —
 * and better-auth's own tables use both.
 */
export type ColumnType =
  'text' | 'integer' | 'real' | 'boolean' | 'timestamp' | 'timestampMs' | 'json';

export type ColumnDeclaration = {
  /** The document-side name. The adapter derives the stored column name from it. */
  name: string;
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  unique?: boolean;
  /** Written into the schema as the column's `DEFAULT`, so only a literal. */
  defaultValue?: string | number | boolean;
  /**
   * A foreign key, named in slug space — never as a table.
   *
   * `column` defaults to `id` and `onDelete` to `cascade`, which is every case there is today.
   * A declaration may point at its own `table`: a directory's parent is a directory, which is the
   * one shape a prototype's own fields never produce.
   */
  references?: { table: string; column?: string; onDelete?: 'cascade' | 'set null' };
};

export type TableDeclaration = {
  /**
   * The table's slug, `$`-prefixed to mark it rime-derived — `$authUsers`.
   *
   * It is an identifier, not a table name: the adapter maps it to both the name the schema exports
   * it under and the name it has in the database.
   */
  slug: string;
  columns: ColumnDeclaration[];
};
/**
 * How a feature describes storage it needs, in core's terms.
 *
 * A `versions` deviates a prototype's own table and a prototype's fields become its columns. Neither
 * covers a table that belongs to the **feature** — better-auth's four, an api-key store, an audit
 * log. Those were written out as drizzle source inside the schema generator, which is how the
 * database layer came to know that a collection called `staff` exists and is special.
 *
 * No drizzle here, and no SQL: a declaration says what the storage *is*, and the adapter decides
 * how to spell it. That is the same line `Adapter` draws, for the same reason — a second adapter
 * has to be able to satisfy this.
 */
