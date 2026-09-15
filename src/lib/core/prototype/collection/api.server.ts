import { RimeError } from '$lib/core/errors/index.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import type { RegisterCollection } from '$lib/index.js';
import type { PrototypeApiContext } from '../define.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import { withoutPrivateFields } from '$lib/core/auth/constant.server.js';
import { isAuth } from '$lib/core/auth/enabled.js';
import { versionsReadQuery } from '$lib/core/prototype/shared/versions/read-query.js';
import type { CollectionSlug } from '../types.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import { create, type CreateArgs } from './operations/create.js';
import { deleteById, type DeleteByIdArgs } from './operations/delete-by-id.js';
import { deleteDocs, type DeleteArgs } from './operations/delete.js';
import { duplicate, type DuplicateArgs } from './operations/duplicate.js';
import { findById, type FindByIdArgs } from './operations/find-by-id.js';
import { find, type FindArgs } from './operations/find.js';
import { updateById, type UpdateByIdArgs } from './operations/update-by-id.js';

/** What building a collection's API for one request needs. */
export type CollectionApiArgs = {
  config: BuiltCollection;
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * Everything `rime.collection('pages')` can do, in the collection's own folder, beside the
 * operations that implement it.
 *
 * A class, and the operations are handed `this`. It was a `context()` building a plumbing object,
 * a `shape(ctx)` returning the verbs, a `build()` wiring `system` around them and a
 * `collectionApi()` calling that — four functions to hand back one object, and a
 * `ReturnType<typeof shape>` to name it afterwards.
 *
 * The plumbing members below `system` are what the operations reach for; `CollectionApi` at the
 * foot of this file is the list a caller sees.
 */
class CollectionAPI<
  Doc extends RegisterCollection[CollectionSlug]
> implements PrototypeApiContext<BuiltCollection> {
  readonly config: BuiltCollection;
  readonly event: RequestEvent;
  readonly defaultLocale: string | undefined;

  /** True when rime itself is the caller: access checks and some hooks stand down. */
  readonly isSystemOperation: boolean;

  constructor(
    private readonly args: CollectionApiArgs,
    isSystemOperation = false
  ) {
    this.config = args.config;
    this.event = args.event;
    this.defaultLocale = args.defaultLocale;
    this.isSystemOperation = isSystemOperation;
  }

  /**
   * The same API, telling the pipeline that rime is the caller.
   *
   * A new instance rather than a flag, so a system call cannot leak back into the one it was
   * escalated from. `system(false)` hands this one back, which is what lets `system(someBoolean)`
   * read as "escalate if needed".
   */
  system(isSystem = true): CollectionAPI<Doc> {
    return isSystem ? new CollectionAPI<Doc>(this.args, true) : this;
  }

  /**
   * A document of this collection's shape with every default applied, and no id.
   *
   * An auth collection hands back nothing private. Only a collection signs in, which is why this
   * step is here and not on the area's.
   *
   * **Likely dead, to be checked and dropped.** `withoutPrivateFields` strips `PRIVATE_FIELDS`, and
   * of those only `apiKeyId` is ever a member of `config.fields` — `augment.ts` adds it, hidden, on
   * an apiKey collection. `password` is appended per-operation by `augmentFieldsPassword`, which
   * runs *after* the blank merge, and the rest are columns no field declares. So the one member
   * this can remove is `apiKeyId`, which `removePrivateFields` takes off again on every read. If
   * that holds, an auth collection's blank is a blank like any other and this line is ceremony.
   */
  blank(): Doc {
    const doc = this.config.blank(this.event);
    return (isAuth(this.config) ? withoutPrivateFields(doc) : doc) as Doc;
  }

  /** The locale to act in: the one asked for, else the request's, else the config's default. */
  fallbackLocale(locale?: string): string | undefined {
    return locale || this.event.locals.locale || this.defaultLocale;
  }

  /** Which version row a read means — see `versionsReadQuery`. */
  versionQuery(params: { latest?: boolean; versionId?: string }): OperationQuery | undefined {
    return versionsReadQuery({ config: this.config, params });
  }

  /** Read through the API cache when it is on and this is not a system call. */
  cached<T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T> {
    if (!this.event.locals.cacheEnabled || this.isSystemOperation) return read();

    const cacheKey = this.event.locals.rime.cache.createKey(operation, {
      slug: this.config.slug,
      userEmail: this.event.locals.user?.email,
      userRoles: this.event.locals.user?.roles,
      ...key
    });

    return this.event.locals.rime.cache.get(cacheKey, read);
  }

  /**
   * Creates a new document in the collection
   *
   * @example
   * const post = await rime.collection('posts').create({
   *   data: { title: 'Hello World', content: 'My first post' },
   *   locale: 'en'
   * });
   */
  create(args: CreateArgs<Doc>): Promise<Doc> {
    return create<Doc>({
      ctx: this,
      data: args.data,
      locale: this.fallbackLocale(args.locale)
    });
  }

  /**
   * Duplicate a document in the collection
   *
   * @example
   * const post = await rime.collection('posts').duplicate({ id: '1234' });
   * // A given row rather than the newest real version
   * const copy = await rime.collection('posts').duplicate({ id: '1234', versionId: 'abcd' });
   */
  duplicate(args: DuplicateArgs): Promise<string> {
    return duplicate({ ctx: this, id: args.id, versionId: args.versionId });
  }

  /**
   * Finds documents in the collection matching the query
   *
   * @example
   * // Find published posts sorted by creation date
   * const posts = await rime.collection('posts').find({
   *   query: { published: true },
   *   sort: '-createdAt',
   *   limit: 10
   * });
   */
  find(args: FindArgs = {}): Promise<Doc[]> {
    const {
      query,
      locale,
      sort = '-updatedAt',
      depth = 0,
      limit,
      offset,
      latest,
      select,
      localeFallback
    } = args;

    // The key holds the locale as the *caller* gave it, not the resolved one — preserved from
    // the class this replaces. Reachable only from a local-API call that omits `locale` while
    // the API cache is on, which the REST layer never does: it always passes rime.getLocale().
    return this.cached(
      'collection.find',
      { select, sort, depth, limit, offset, locale, latest, query, localeFallback },
      () =>
        find<Doc>({
          ctx: this,
          select,
          query,
          sort,
          depth,
          limit,
          offset,
          latest,
          localeFallback,
          locale: this.fallbackLocale(locale)
        })
    );
  }

  /**
   * Finds a document in the collection by ID
   *
   * For collections with versioning:
   * - If versionId is provided: Retrieves that specific version
   * - If no versionId and latest=true: Retrieves the newest version, whatever its status
   * - If no versionId and draft=false: Retrieves the published version
   *
   * @example
   * // Get published version
   * const post = await rime.collection('posts').findById({ id: '12345' });
   *
   * // Get specific version
   * const post = await rime.collection('posts').findById({
   *   id: '12345',
   *   versionId: 'v2',
   *   locale: 'en'
   * });
   *
   * // Get latest draft version
   * const post = await rime.collection('posts').findById({
   *   id: '12345',
   *   latest: true
   * });
   */
  findById(args: FindByIdArgs): Promise<Doc> {
    const { id, versionId, locale, select, latest, depth = 0, localeFallback } = args;

    if (!id) {
      throw new RimeError(RimeError.NOT_FOUND);
    }

    return this.cached(
      'collection.findById',
      { id, versionId, select, depth, latest, locale, localeFallback },
      () =>
        findById<Doc>({
          ctx: this,
          id,
          versionId,
          select,
          depth,
          latest,
          localeFallback,
          locale: this.fallbackLocale(locale)
        })
    );
  }

  /**
   * Updates a document in the collection by ID.
   *
   * `versionId`, else `latest`, else the published version selects the row; `fork` makes a new
   * version from it instead of writing it. A config with versions and no drafts keeps a version
   * per save, so an update that names no row is a fork there.
   *
   * @example
   * // Write the published version
   * await rime.collection('posts').updateById({ id, data: { title: 'New title' } });
   *
   * // Write the newest version, draft or not
   * await rime.collection('posts').updateById({ id, data, latest: true });
   *
   * // A new draft from the published version
   * await rime.collection('posts').updateById({ id, data, fork: true });
   */
  updateById(args: UpdateByIdArgs<Doc>): Promise<Doc> {
    return updateById<Doc>({
      ...args,
      ctx: this,
      locale: this.fallbackLocale(args.locale)
    });
  }

  /**
   * Deletes a document in the collection by ID
   *
   * @example
   * const post = await rime.collection('posts').deleteById({ id: '12345' });
   */
  deleteById(args: DeleteByIdArgs): Promise<string> {
    return deleteById({ ctx: this, id: args.id });
  }

  /**
   * Deletes multiple documents in the collection. No query means no filter —
   * `delete()` with no args deletes every document in the collection.
   *
   * @example
   * const posts = await rime.collection('posts').delete({
   *   query: { published: true },
   *   limit: 10
   * });
   */
  delete(args: DeleteArgs = {}): Promise<string[]> {
    return deleteDocs({ ctx: this, ...args });
  }
}

/** Builds a collection's API for one request. What `rime.collection(slug)` calls. */
export const collectionApi = <Doc extends RegisterCollection[CollectionSlug]>(
  args: CollectionApiArgs
): CollectionApi<Doc> => new CollectionAPI<Doc>(args);

/**
 * What `rime.collection(slug)` hands back — **written out**, not read off the class.
 *
 * The class also carries the plumbing its operations reach for (`event`, `cached`,
 * `versionQuery`, `fallbackLocale`, `isSystemOperation`); none of that is a caller's business, and
 * naming `RequestEvent` in this type would be worse than untidy. `event.locals.rime` is typed as
 * this accessor's owner, so a surface that reached `RequestEvent` would be defined in terms of
 * itself and every `rime.collection(...)` in the repo would resolve to `never`. Each operation
 * exports its caller-facing arguments separately for the same reason.
 */
export type CollectionApi<
  Doc extends RegisterCollection[CollectionSlug] = RegisterCollection[CollectionSlug]
> = Pick<
  CollectionAPI<Doc>,
  | 'config'
  | 'blank'
  | 'create'
  | 'duplicate'
  | 'find'
  | 'findById'
  | 'updateById'
  | 'deleteById'
  | 'delete'
  | 'system'
>;

export type CollectionAccessor = <Slug extends keyof RegisterCollection>(
  slug: Slug
) => CollectionApi<RegisterCollection[Slug]>;
