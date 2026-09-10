import { RimeError } from '$lib/core/errors/index.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import type { RegisterCollection } from '$lib/index.js';
import type { PrototypeApiContext } from '../define.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { GenericDoc } from '../types.js';
import { blankAuthDocument } from '$lib/core/auth/blank.server.js';
import { isAuth } from '$lib/core/auth/enabled.js';
import { createBlankDocument } from '../doc.js';
import { versionsReadQuery } from '$lib/core/prototype/shared/versions/read-query.js';
import type { CollectionSlug } from '../types.js';
import { create, type CreateArgs } from './operations/create.js';
import { deleteById, type DeleteByIdArgs } from './operations/delete-by-id.js';
import { deleteDocs, type DeleteArgs } from './operations/delete.js';
import { duplicate, type DuplicateArgs } from './operations/duplicate.js';
import { findById, type FindByIdArgs } from './operations/find-by-id.js';
import { find, type FindArgs } from './operations/find.js';
import { updateById, type UpdateByIdArgs } from './operations/update-by-id.js';

type Ctx = PrototypeApiContext<BuiltCollection>;

/** What building a collection's API for one request needs. */
export type CollectionApiArgs = {
  config: BuiltCollection;
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * The per-call plumbing this collection's operations are handed.
 *
 * Written out here rather than shared with the area's. The two contexts were one
 * `prototypeContext` and they are not the same object: a collection's `blank()` strips auth's private members, because only a collection
 * signs in; an area's publishes its first version, because only an area is booted. Neither step
 * was ever reachable from the other kind, and a shared `shapeBlank` with an `intent` parameter
 * existed to say so.
 *
 * Per-call, not per-process — `isSystemOperation` is part of it, so `.system()` is a second
 * context rather than a flag anybody has to remember to forward.
 */
const context = (args: CollectionApiArgs & { isSystemOperation: boolean }): Ctx => {
  const { config, event, defaultLocale, isSystemOperation } = args;

  return {
    config,
    event,
    defaultLocale,
    isSystemOperation,

    fallbackLocale: (locale?: string) => locale || event.locals.locale || defaultLocale,

    versionQuery: (params, intent = 'read') => versionsReadQuery({ config, params, intent }),

    blank: () =>
      (isAuth(config)
        ? blankAuthDocument(createBlankDocument(config, event))
        : createBlankDocument(config, event)) as GenericDoc,

    cached: <T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T> => {
      if (!event.locals.cacheEnabled || isSystemOperation) return read();

      const cacheKey = event.locals.rime.cache.createKey(operation, {
        slug: config.slug,
        userEmail: event.locals.user?.email,
        userRoles: event.locals.user?.roles,
        ...key
      });

      return event.locals.rime.cache.get(cacheKey, read);
    }
  };
};

/**
 * Adds `.system()`: the same API over an escalated context.
 *
 * It has to *re-enter* the builder — a system call is the same API over a different context, not a
 * mutable flag on a shared object — so it cannot be a plain member. `system(false)` hands back the
 * API it was called on, which is what lets `system(someBoolean)` read as "escalate if needed".
 */
const build = <Doc extends RegisterCollection[CollectionSlug]>(
  args: CollectionApiArgs,
  isSystemOperation = false
): CollectionApi<Doc> => {
  const api = shape<Doc>(context({ ...args, isSystemOperation })) as CollectionApi<Doc>;
  api.system = (isSystem = true) => (isSystem ? build<Doc>(args, true) : api);
  return api;
};

/**
 * Everything `rime.collection('pages')` hands back, declared here in the collection's own folder,
 * next to the operations that implement it.
 *
 * **Its whole surface**, `config` and `blank` included. Those used to be appended by a shared
 * `buildPrototypeApi`, which meant no single file said what a collection's API actually was.
 * `system` is the one exception, and it is composed rather than appended — see `build` below.
 */
const shape = <Doc extends RegisterCollection[CollectionSlug]>(ctx: Ctx) => ({
  /** The built config this API acts on. */
  config: ctx.config,

  /** A document of this collection's shape with every default applied, and no id. */
  blank: ctx.blank as () => Doc,

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
      ctx,
      data: args.data,
      locale: ctx.fallbackLocale(args.locale)
    });
  },

  /**
   * Duplicate a document in the collection
   *
   * @example
   * const post = await rime.collection('posts').duplicate({ id: '1234' });
   */
  duplicate(args: DuplicateArgs): Promise<string> {
    return duplicate({ ctx, id: args.id });
  },

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
    const { query, locale, sort = '-updatedAt', depth = 0, limit, offset, draft, select } = args;

    // The key holds the locale as the *caller* gave it, not the resolved one — preserved from
    // the class this replaces. Reachable only from a local-API call that omits `locale` while
    // the API cache is on, which the REST layer never does: it always passes rime.getLocale().
    return ctx.cached(
      'collection.find',
      { select, sort, depth, limit, offset, locale, draft, query },
      () =>
        find<Doc>({
          ctx,
          select,
          query,
          sort,
          depth,
          limit,
          offset,
          draft,
          locale: ctx.fallbackLocale(locale)
        })
    );
  },

  /**
   * Finds a document in the collection by ID
   *
   * For collections with versioning:
   * - If versionId is provided: Retrieves that specific version
   * - If no versionId and draft=true: Retrieves the latest draft if available
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
   *   draft: true
   * });
   */
  findById(args: FindByIdArgs): Promise<Doc> {
    const { id, versionId, locale, select, draft, depth = 0 } = args;

    if (!id) {
      throw new RimeError(RimeError.NOT_FOUND);
    }

    return ctx.cached('collection.findById', { id, versionId, select, depth, draft, locale }, () =>
      findById<Doc>({
        ctx,
        id,
        versionId,
        select,
        depth,
        draft,
        locale: ctx.fallbackLocale(locale)
      })
    );
  },

  /**
   * Updates a document in the collection by ID
   *
   * For collections with versioning:
   * - For non-versioned collections: Simply updates the document
   * - For versioned collections without draft support:
   *   - If versionId is provided: Updates that specific version
   *   - If no versionId is provided: Creates a new version based on the latest
   * - For versioned collections with draft support:
   *   - If versionId is provided: Updates that specific version
   *   - If no versionId and draft !== true: Updates the published version
   *   - If no versionId and draft === true: Creates a new draft from the published version
   *
   * @example
   * // Update published version
   * const post = await rime.collection('posts').updateById({
   *   id: '12345',
   *   data: { title: 'New title' },
   *   locale: 'en'
   * });
   *
   * // Create or update draft version
   * const post = await rime.collection('posts').updateById({
   *   id: '12345',
   *   data: { title: 'Draft title' },
   *   draft: true
   * });
   */
  updateById(args: UpdateByIdArgs<Doc>): Promise<Doc> {
    return updateById<Doc>({
      ...args,
      ctx,
      locale: ctx.fallbackLocale(args.locale)
    });
  },

  /**
   * Deletes a document in the collection by ID
   *
   * @example
   * const post = await rime.collection('posts').deleteById({ id: '12345' });
   */
  deleteById(args: DeleteByIdArgs): Promise<string> {
    return deleteById({ ctx, id: args.id });
  },

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
    return deleteDocs({ ctx, ...args });
  }
});

/** Builds a collection's API for one request. What `rime.collection(slug)` calls. */
export const collectionApi = <Doc extends RegisterCollection[CollectionSlug]>(
  args: CollectionApiArgs
): CollectionApi<Doc> => build<Doc>(args);

/**
 * What `rime.collection(slug)` hands back.
 *
 * Read off the factory above rather than written out again — but note what the factory's
 * signatures deliberately do *not* mention: the context. `event.locals.rime` is typed as this
 * accessor's owner, so an API surface that named `PrototypeApiContext` (and through it
 * `RequestEvent`) would be defined in terms of itself, and every `rime.collection(...)` call in
 * the repo would resolve to `never`. Each operation exports its caller-facing arguments
 * separately for that reason.
 */
export type CollectionApi<
  Doc extends RegisterCollection[CollectionSlug] = RegisterCollection[CollectionSlug]
> = ReturnType<typeof shape<Doc>> & { system(isSystem?: boolean): CollectionApi<Doc> };

export type CollectionAccessor = <Slug extends keyof RegisterCollection>(
  slug: Slug
) => CollectionApi<RegisterCollection[Slug]>;
