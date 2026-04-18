import { RimeError } from '$lib/core/errors/index.js';
import { FormFieldBuilder, type RegisterCollection } from '$lib/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import { createBlankDocument } from '../../util/doc.js';
import type { BuiltCollection } from '../config/types.js';
import type { CollectionSlug } from '../types/doc.js';
import { PRIVATE_FIELDS } from './auth/constant.server.js';
import { isAuthConfig } from './auth/util.js';
import { create } from './operations/create.js';
import { deleteDocs } from './operations/delete.js';
import { deleteById } from './operations/deleteById.js';
import { duplicate } from './operations/duplicate.js';
import { find } from './operations/find.js';
import { findById } from './operations/findById.js';
import { updateById } from './operations/updateById.js';

type Args = {
  config: BuiltCollection;
  defaultLocale: string | undefined;
  event: RequestEvent;
};

/**
 * Facade for interacting with a collection
 *
 * Provides methods to create, retrieve, update, and delete documents within a collection.
 * Handles versioning, drafts, authentication, and localization according to the collection configuration.
 */
class CollectionAPI<Doc extends RegisterCollection[CollectionSlug]> {
  #event: RequestEvent;
  defaultLocale: string | undefined;
  config: BuiltCollection;
  isSystemOperation: boolean;

  /**
   * Initializes the collection facade
   */
  constructor({ config, defaultLocale, event }: Args) {
    this.config = config;
    this.defaultLocale = defaultLocale;
    this.#event = event;
    this.create = this.create.bind(this);
    this.find = this.find.bind(this);
    this.findById = this.findById.bind(this);
    this.updateById = this.updateById.bind(this);
    this.deleteById = this.deleteById.bind(this);
    this.isSystemOperation = false;
  }

  system(isSytem: boolean = true) {
    if (isSytem === false) return this;
    // Return a proxy or new instance with system flag
    const systemCollection = new CollectionAPI({
      config: this.config,
      defaultLocale: this.defaultLocale,
      event: this.#event
    });
    systemCollection.isSystemOperation = true;
    return systemCollection;
  }

  /**
   * Returns the locale to use, with fallback logic
   * Prioritizes provided locale, then event locale, then default locale
   *
   * @returns The locale to use
   */
  #fallbackLocale(locale?: string) {
    return locale || this.#event.locals.locale || this.defaultLocale;
  }

  /**
   * Creates a blank document based on the collection schema
   * For auth collections, private fields are filtered out
   *
   * @returns A blank document with default values
   *
   * @example
   * const emptyDoc = rime.collection('posts').blank();
   */
  blank(): Doc {
    if (isAuthConfig(this.config)) {
      const withoutPrivateFields = this.config.fields
        .filter((f) => f instanceof FormFieldBuilder)
        .filter((f) => !PRIVATE_FIELDS.includes(f.name));

      return createBlankDocument(
        {
          ...this.config,
          fields: [...withoutPrivateFields]
        },
        this.#event
      ) as Doc;
    }
    return createBlankDocument(this.config, this.#event) as Doc;
  }

  /**
   * Checks if this collection is an authentication collection
   *
   * @returns True if this is an auth collection
   */
  get isAuth() {
    return !!this.config.auth;
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
  create(args: APIMethodArgs<typeof create>): Promise<Doc> {
    return create<Doc>({
      //@ts-expect-error args.data is DeepPartial<RegisterCollection[CollectionSlug]> and expect exactlly this
      data: args.data,
      locale: this.#fallbackLocale(args.locale),
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation
    });
  }

  /**
   * Duplicate a document in the collection
   *
   * @example
   * const post = await rime.collection('posts').duplicate({
   *   id: '1234'
   * });
   */
  duplicate(args: APIMethodArgs<typeof duplicate>): Promise<string> {
    return duplicate({
      id: args.id,
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation
    });
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
  find(args: APIMethodArgs<typeof find>): Promise<Doc[]> {
    const { query, locale, sort = '-updatedAt', depth = 0, limit, offset, draft } = args;

    const params = {
      select: args.select,
      query,
      locale: this.#fallbackLocale(locale),
      config: this.config,
      event: this.#event,
      sort,
      depth,
      limit,
      draft,
      offset,
      isSystemOperation: this.isSystemOperation
    };

    if (this.#event.locals.cacheEnabled && !this.isSystemOperation) {
      const key = this.#event.locals.rime.cache.createKey('collection.find', {
        slug: this.config.slug,
        select: args.select,
        userEmail: this.#event.locals.user?.email,
        userRoles: this.#event.locals.user?.roles,
        sort,
        depth,
        limit,
        offset,
        locale,
        draft,
        query
      });
      return this.#event.locals.rime.cache.get(key, () => find<Doc>(params));
    }

    return find<Doc>(params);
  }

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
  findById(args: APIMethodArgs<typeof findById>): Promise<Doc> {
    const { id, versionId, locale, draft, depth = 0 } = args;

    if (!id) {
      throw new RimeError(RimeError.NOT_FOUND);
    }
    const params = {
      id,
      versionId,
      locale: this.#fallbackLocale(locale),
      config: this.config,
      event: this.#event,
      draft,
      depth,
      isSystemOperation: this.isSystemOperation
    };

    if (this.#event.locals.cacheEnabled && !this.isSystemOperation) {
      const key = this.#event.locals.rime.cache.createKey('collection.findById', {
        slug: this.config.slug,
        userEmail: this.#event.locals.user?.email,
        userRoles: this.#event.locals.user?.roles,
        id,
        versionId,
        depth,
        draft,
        locale
      });
      return this.#event.locals.rime.cache.get(key, () => findById<Doc>(params));
    }

    return findById<Doc>(params);
  }

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
   * // Update specific version
   * const post = await rime.collection('posts').updateById({
   *   id: '12345',
   *   versionId: 'v2',
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
  updateById(args: APIMethodArgs<typeof updateById>): Promise<Doc> {
    return updateById<Doc>({
      ...args,
      locale: this.#fallbackLocale(args.locale),
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation
    });
  }

  /**
   * Deletes a document in the collection by ID
   *
   * @example
   * const post = await rime.collection('posts').deleteById('12345');
   */
  deleteById = ({ id }: APIMethodArgs<typeof deleteById>) => {
    return deleteById({
      id,
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation
    });
  };

  /**
   * Deletes multiple documents in the collection
   *
   * @example
   * const posts = await rime.collection('posts').delete({
   *   query: { published: true },
   *   limit: 10
   * });
   */
  delete = (args: APIMethodArgs<typeof deleteDocs>) => {
    return deleteDocs({
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation,
      ...args
    });
  };
}

export { CollectionAPI };

/****************************************************
/* Types
/****************************************************/

type APIMethodArgs<T extends (...args: any) => any> = Omit<
  Parameters<T>[0],
  'rime' | 'event' | 'config' | 'slug'
>;
