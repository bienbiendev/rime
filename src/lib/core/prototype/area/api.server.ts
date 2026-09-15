import type { BuiltArea } from '$lib/core/config/types.js';
import type { RegisterArea } from '$lib/index.js';
import type { PrototypeApiContext } from '../define.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import type { GenericDoc } from '../types.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import { versionsReadQuery } from '$lib/core/prototype/shared/versions/read-query.js';
import { find, type FindArgs } from './operations/find.js';
import { update, type UpdateArgs } from './operations/update.js';

/** What building an area's API for one request needs. */
export type AreaApiArgs = {
  config: BuiltArea;
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * Everything `rime.area('settings')` can do: exactly two operations.
 *
 * There is no `create` and no `delete` — not switched off, absent, because a singleton has no
 * second document to make and nothing left to read if its only one goes. Nor is there an id
 * anywhere in these signatures. That is the whole difference from a collection, and it is why
 * this is its own class rather than a collection with a flag.
 *
 * `blank()` is the document as its fields default it, full stop: no auth step, because an area
 * lists no `auth`. The collection's strips auth's private members — the two were one
 * `prototypeContext` with a `shapeBlank(doc, config, intent)` between them, for a branch neither
 * kind could reach.
 */
class AreaAPI<Doc extends GenericDoc> implements PrototypeApiContext<BuiltArea> {
  readonly config: BuiltArea;
  readonly event: RequestEvent;
  readonly defaultLocale: string | undefined;

  /** True when rime itself is the caller: access checks and some hooks stand down. */
  readonly isSystemOperation: boolean;

  constructor(
    private readonly args: AreaApiArgs,
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
   * escalated from. `system(false)` hands this one back.
   */
  system(isSystem = true): AreaAPI<Doc> {
    return isSystem ? new AreaAPI<Doc>(this.args, true) : this;
  }

  /** The area's document with every default applied. */
  blank(): Doc {
    return this.config.blank(this.event) as Doc;
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
   * Retrieves the area's document
   *
   * - For non-versioned areas: Returns the single document
   * - For versioned areas without draft support: Returns the latest version by default, or a
   *   specific version if versionId is provided
   * - For versioned areas with draft support:
   *   - If versionId is provided: Returns that specific version
   *   - If latest=true: Returns the newest version (regardless of status)
   *   - If draft=false: Returns the published version
   *
   * @example
   * const doc = await rime.area('settings').find({ locale })
   * const doc = await rime.area('settings').find({ versionId: '123' })
   * const doc = await rime.area('settings').find({ latest: true })
   */
  find(args: FindArgs = {}): Promise<Doc> {
    const { locale, select = [], depth = 0, versionId, latest, localeFallback } = args;

    // As on a collection's find: the key holds the caller's locale, not the resolved one.
    return this.cached(
      'area.find',
      { select, versionId, depth, latest, locale, localeFallback },
      () =>
        find<Doc>({
          ctx: this,
          select,
          versionId,
          depth,
          latest,
          localeFallback,
          locale: this.fallbackLocale(locale)
        })
    );
  }

  /**
   * Updates the area's document
   *
   * `versionId`, else `latest`, else the published version selects the row; `fork` makes a new
   * version from it instead of writing it. See the collection's `updateById`.
   *
   * @example
   * rime.area('settings').update({ data, locale })
   */
  update(args: UpdateArgs<Doc>): Promise<Doc> {
    const { data, locale, versionId, latest, fork, autoSave } = args;

    return update<Doc>({
      ctx: this,
      data,
      versionId,
      latest,
      fork,
      autoSave,
      locale: this.fallbackLocale(locale)
    });
  }
}

/** Builds an area's API for one request. What `rime.area(slug)` calls. */
export const areaApi = <Doc extends GenericDoc>(args: AreaApiArgs): AreaApi<Doc> =>
  new AreaAPI<Doc>(args);

/**
 * What `rime.area(slug)` hands back — written out, not read off the class. See the note on
 * `CollectionApi` for why the plumbing must not appear in this type.
 */
export type AreaApi<Doc extends GenericDoc = GenericDoc> = Pick<
  AreaAPI<Doc>,
  'config' | 'blank' | 'find' | 'update' | 'system'
>;

export type AreaAccessor = <Slug extends keyof RegisterArea>(
  slug: Slug
) => AreaApi<RegisterArea[Slug]>;
