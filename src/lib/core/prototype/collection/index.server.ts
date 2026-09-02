import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import type { RegisterCollection } from '$lib/index.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { PrototypeApi, PrototypeApiContext } from '../define.js';
import { definePrototype } from '../define.js';
import type { CollectionSlug } from '../types.js';
import { create, type CreateArgs } from './operations/create.js';
import { deleteById, type DeleteByIdArgs } from './operations/delete-by-id.js';
import { deleteDocs, type DeleteArgs } from './operations/delete.js';
import { duplicate, type DuplicateArgs } from './operations/duplicate.js';
import { find, type FindArgs } from './operations/find.js';
import { findById, type FindByIdArgs } from './operations/find-by-id.js';
import { updateById, type UpdateByIdArgs } from './operations/update-by-id.js';

type Ctx = PrototypeApiContext<BuiltCollection>;

/**
 * The local API a collection provides.
 *
 * Everything a caller reaches through `rime.collection('pages')` is declared here, in the
 * collection's own folder, next to the operations that implement it. `blank`, `system` and
 * `config` are not — they belong to every prototype, so `buildPrototypeApi` adds them.
 */
const api = <Doc extends RegisterCollection[CollectionSlug]>(ctx: Ctx) => ({
  /**
   * Whether this collection carries authentication.
   *
   * @example
   * if (rime.collection('users').isAuth) { … }
   */
  isAuth: !!ctx.config.auth,

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
> = PrototypeApi<ReturnType<typeof api<Doc>>, Doc> & { config: BuiltCollection };

export type CollectionAccessor = <Slug extends keyof RegisterCollection>(
  slug: Slug
) => CollectionApi<RegisterCollection[Slug]>;

/**
 * A collection: many documents, addressed by id, with the full set of operations.
 *
 * It is a definition rather than "the absence of area" so that code iterating the registry sees
 * both kinds, and so `singleton: false` is stated rather than implied. Nothing to do at boot —
 * a collection with no documents is a collection with no documents.
 */
export const collection = definePrototype<BuiltCollection, CollectionAccessor>({
  api: (ctx) => api(ctx)
});
