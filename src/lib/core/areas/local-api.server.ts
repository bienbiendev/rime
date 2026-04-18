import type { BuiltArea } from '$lib/core/config/types.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { RequestEvent } from '@sveltejs/kit';
import { createBlankDocument } from '../../util/doc.js';
import { find } from './operations/find.js';
import { update } from './operations/update.js';

type Args = {
  config: BuiltArea;
  defaultLocale: string | undefined;
  event: RequestEvent;
};

/**
 * Facade for interacting with area documents
 *
 * Provides methods to create, retrieve, and update documents within an area.
 * Handles versioning, drafts, and localization according to the area configuration.
 *
 */
class AreaAPI<Doc extends GenericDoc = GenericDoc> {
  #event: RequestEvent;
  defaultLocale: string | undefined;
  config: BuiltArea;
  isSystemOperation: boolean;

  /**
   * Creates a new AreaAPI instance
   *
   * @param args Constructor arguments
   * @param args.config The compiled area configuration
   * @param args.defaultLocale The default locale to use when none is specified
   * @param args.event The current request event
   */

  constructor({ config, defaultLocale, event }: Args) {
    this.config = config;
    this.#event = event;
    this.defaultLocale = defaultLocale;
    this.find = this.find.bind(this);
    this.update = this.update.bind(this);
    this.isSystemOperation = false;
  }

  /**
   * Determines the locale to use, falling back to defaults if not provided
   *
   * @param locale Optional locale string
   * @returns The locale to use, falling back to event locale or default locale
   * @private
   */
  #fallbackLocale(locale?: string) {
    return locale || this.#event.locals.locale || this.defaultLocale;
  }

  blank(): Doc {
    return createBlankDocument(this.config, this.#event) as Doc;
  }

  /**
   * Retrieves an area document with optional filtering and selection
   *
   * This method handles different retrieval scenarios based on the provided parameters:
   * - For non-versioned areas: Returns the single document
   * - For versioned areas without draft support: Returns the latest version by default or a specific version if versionId is provided
   * - For versioned areas with draft support:
   *   - If versionId is provided: Returns that specific version
   *   - If draft=true: Returns the latest version (regardless of status)
   *   - If draft=false: Returns the published version
   *
   * @example
   * // Get the published version
   * const doc = await rime.area('settings').find({ locale })
   *
   * // Get a specific version
   * const doc = await rime.area('settings').find({ versionId: '123' })
   *
   * // Get the latest version excluding draft
   * const doc = await rime.area('settings').find()
   *
   * // Get the latest version including draft
   * const doc = await rime.area('settings').find({ draft: true })
   */
  find(args: APIMethodArgs<typeof find>): Promise<Doc> {
    const { locale, select = [], depth = 0, versionId, draft } = args;

    const params = {
      locale: this.#fallbackLocale(locale),
      select,
      versionId,
      config: this.config,
      event: this.#event,
      depth,
      draft,
      isSystemOperation: this.isSystemOperation
    };

    if (this.#event.locals.cacheEnabled && !this.isSystemOperation) {
      const key = this.#event.locals.rime.cache.createKey('area.find', {
        slug: this.config.slug,
        select,
        versionId,
        userEmail: this.#event.locals.user?.email,
        userRoles: this.#event.locals.user?.roles,
        depth,
        draft,
        locale
      });
      return this.#event.locals.rime.cache.get(key, () => find<Doc>(params));
    }

    return find<Doc>(params);
  }

  /**
   * Updates an area document with the provided data
   *
   * This method handles different update scenarios based on the provided parameters:
   * - For non-versioned areas: Simply updates the document
   * - For versioned areas without draft support:
   *   - If versionId is provided: Updates that specific version
   *   - If no versionId is provided: Creates a new version based on the latest
   * - For versioned areas with draft support:
   *   - If versionId is provided: Updates that specific version
   *   - If no versionId and draft !== true: Updates the published version
   *   - If no versionId and draft === true: Creates a new draft from the published version
   *
   * @example
   * rime.area('settings').update({ data, locale })
   */
  update(args: APIMethodArgs<typeof update>): Promise<Doc> {
    const { data, locale, versionId, draft } = args;

    return update<Doc>({
      data,
      locale: this.#fallbackLocale(locale),
      versionId: versionId,
      draft,
      config: this.config,
      event: this.#event,
      isSystemOperation: this.isSystemOperation
    });
  }
}

export { AreaAPI };

/****************************************************
/* Types
/****************************************************/

type APIMethodArgs<T extends (...args: any) => any> = Omit<
  Parameters<T>[0],
  'rime' | 'event' | 'config' | 'slug'
>;
