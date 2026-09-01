import type { VERSIONS_OPERATIONS } from '$lib/core/features/versions/strategy.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';
import type {
  AreaSlug,
  CollectionSlug,
  GenericBlock,
  GenericDoc,
  PrototypeSlug,
  RawDoc,
  TreeBlock
} from '$lib/core/prototype/types.js';
import type { User } from '$lib/core/features/auth/types.js';
import type { OperationQuery } from '$lib/core/operations/types.js';
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
  collection: CollectionAdapter;
  area: AreaAdapter;
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

export type UpdateDocumentUrlParams = {
  id: string;
  versionId?: string;
  /** Which of the four writes to make (root, locale, version, version+locale) reads off this. */
  config: BuiltArea | BuiltCollection;
  locale?: string;
};

export interface CollectionAdapter {
  findById(args: {
    slug: CollectionSlug;
    id: string;
    versionId?: string;
    locale?: string;
    select?: string[];
    draft?: boolean;
  }): Promise<RawDoc>;

  find(args: {
    slug: CollectionSlug;
    select?: string[];
    query?: OperationQuery;
    sort?: string;
    limit?: number;
    offset?: number;
    locale?: string;
    draft?: boolean;
  }): Promise<RawDoc[]>;

  insert(args: {
    slug: CollectionSlug;
    data: DeepPartial<GenericDoc>;
    locale?: string;
  }): Promise<{ id: string; versionId: string }>;

  update(args: {
    slug: CollectionSlug;
    id: string;
    versionId?: string;
    versionOperation: VersionOperation;
    data: DeepPartial<GenericDoc>;
    locale?: string;
  }): Promise<{ id: string }>;

  deleteById(args: { slug: CollectionSlug; id: string }): Promise<string | undefined>;

  /** The ids of the documents parented to `parentId`, in tree order. */
  childrenIds(args: { slug: CollectionSlug; parentId: string }): Promise<string[]>;

  /** Which of `ids` name a document that exists. */
  existingIds(args: { slug: CollectionSlug; ids: string[] }): Promise<string[]>;
}

/**
 * An area is a singleton, and the interface says so by what it leaves out: there is no insert
 * and no delete. Exactly one row exists, so creating a second is not an operation and removing
 * the only one leaves the area unreadable. The sqlite adapter still bootstraps a blank document
 * on first read, but that is its own business and no longer something core can ask for.
 */
export interface AreaAdapter {
  get(args: {
    slug: AreaSlug;
    locale?: string;
    depth?: number;
    select?: string[];
    versionId?: string;
    draft?: boolean;
  }): Promise<RawDoc>;

  update(args: {
    slug: AreaSlug;
    data: DeepPartial<GenericDoc>;
    locale?: string;
    versionId?: string;
    versionOperation: VersionOperation;
  }): Promise<{ id: string }>;
}

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
