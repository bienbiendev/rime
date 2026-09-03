import type { VERSIONS_OPERATIONS } from '$lib/core/features/versions/strategy.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type {
  CollectionSlug,
  GenericBlock,
  GenericDoc,
  PrototypeSlug,
  RawDoc,
  TreeBlock
} from '$lib/core/prototype/types.js';
import type { User } from '$lib/core/features/auth/types.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { BeforeOperationRelation, Relation } from '$lib/fields/relation/index.js';
import type { DeepPartial, Dic, WithOptional, WithRequired } from '$lib/util/types.js';

/**
 * What core requires of a database adapter.
 *
 * Written here, in core's vocabulary, rather than read off an implementation. It used to be
 * `Adapter = { collection: ReturnType<typeof createCollectionFacade>, ... }` declared inside
 * adapter-sqlite — so the interface *was* the implementation, and seven core files imported
 * their central type from `$lib/adapter-sqlite`. Nothing could be said to conform to it,
 * because it was defined as whatever the one adapter happened to return.
 *
 * The rule that decides what may appear below: **every argument and return type is something
 * core can name**. Slugs, documents, blocks, relations, queries, locales. No tables, no
 * columns, no drizzle. A method that cannot be phrased that way is a sign the work is on the
 * wrong side of the line — that is how `parentSlug: TableName` was caught, a parameter that
 * named a slug and carried a table.
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

  blocks: BlocksAdapter;
  tree: TreeAdapter;
  relations: RelationsAdapter;
  transform: TransformAdapter;
  auth: AuthAdapter;

  /** Writes raw column values to one row. Used by the URL and upload features. */
  updateRecord(id: string, tableName: string, data: Dic): Promise<unknown>;

  /** Writes a document's computed `url`, including onto its versions when it has them. */
  updateDocumentUrl(url: string, params: UpdateDocumentUrlParams): Promise<void>;
}

type VersionOperation = (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];

export type RegisterPrototypeArgs = {
  config: BuiltArea | BuiltCollection;
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

  /**
   * One document, merged with the version it should show. `undefined` when nothing matches —
   * the caller decides whether that is a 404.
   *
   * `id` is required to mean anything on a non-singleton, and ignored on a singleton, which has
   * only one row to return.
   */
  find(args?: {
    id?: string;
    versionId?: string;
    select?: string[];
    locale?: string;
    draft?: boolean;
  }): Promise<RawDoc | undefined>;

  findMany(args?: {
    select?: string[];
    query?: OperationQuery;
    sort?: string;
    limit?: number;
    offset?: number;
    locale?: string;
    draft?: boolean;
  }): Promise<RawDoc[]>;

  /** Throws on a singleton: there is no second document to make. */
  insert(args: {
    data: DeepPartial<GenericDoc>;
    locale?: string;
  }): Promise<{ id: string; versionId: string }>;

  /** `id` is required on a non-singleton; a singleton resolves its own row. */
  update(args: {
    id?: string;
    versionId?: string;
    versionOperation: VersionOperation;
    data: DeepPartial<GenericDoc>;
    locale?: string;
  }): Promise<{ id: string }>;

  /** Throws on a singleton: removing the only document leaves nothing to read. */
  delete(args: { id: string }): Promise<string | undefined>;

  /** Boot only. Writes the row if absent; a no-op if not. */
  ensureExists(args: { blank: Dic; locale?: string }): Promise<void>;

  /** The ids of the documents parented to `parentId`, in tree order. */
  childrenIds(args: { parentId: string }): Promise<string[]>;

  /** Which of `ids` name a document that exists. */
  existingIds(args: { ids: string[] }): Promise<string[]>;
}

export type UpdateDocumentUrlParams = {
  id: string;
  versionId?: string;
  /** Which of the four writes to make (root, locale, version, version+locale) reads off this. */
  config: BuiltArea | BuiltCollection;
  locale?: string;
};

/**
 * `parentSlug` is the slug that owns the children — the versions shadow when the prototype is
 * versioned, the prototype itself when not. See `contentOwnerSlug`.
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
  doc(args: Dic): Promise<GenericDoc>;
}

export interface AuthAdapter {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
  hasAuthUser(): Promise<boolean>;
  getBetterAuthUserId(args: { slug: CollectionSlug; id: string }): Promise<string | null>;
  getUserAttributes(args: {
    authUserId: string;
    slug: CollectionSlug;
  }): Promise<User | undefined>;
  isSuperAdmin(userId: string): Promise<boolean>;
  setAuthUserRole(args: { authUserId: string; role: string }): Promise<void>;
  deleteAuthUser(args: { authUserId: string }): Promise<void>;
}
