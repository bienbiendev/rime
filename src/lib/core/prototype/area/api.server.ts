import type { BuiltArea } from '$lib/core/config/types.js';
import type { RegisterArea } from '$lib/index.js';
import type { PrototypeApiContext } from '../define.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Dic } from '$lib/util/types.js';
import { createBlankDocument } from '../doc.js';
import { versionsReadQuery } from '$lib/core/prototype/shared/versions/read-query.js';
import type { GenericDoc } from '../types.js';
import { find, type FindArgs } from './operations/find.js';
import { update, type UpdateArgs } from './operations/update.js';

type Ctx = PrototypeApiContext<BuiltArea>;

/** What building an area's API for one request needs. */
export type AreaApiArgs = {
  config: BuiltArea;
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * The per-call plumbing this area's operations are handed.
 *
 * Written out here rather than shared with the collection's. The two contexts were one
 * `prototypeContext` and they are not the same object: an area's `blank()` is the document as its
 * fields default it, full stop — no auth step, because an area lists no `auth`. The collection's
 * strips auth's private members. Neither was ever reachable from the other kind, and a shared
 * `shapeBlank` with an `intent` parameter existed to say so.
 *
 * Per-call, not per-process — `isSystemOperation` is part of it, so `.system()` is a second
 * context rather than a flag anybody has to remember to forward.
 */
const context = (args: AreaApiArgs & { isSystemOperation: boolean }): Ctx => {
  const { config, event, defaultLocale, isSystemOperation } = args;

  return {
    config,
    event,
    defaultLocale,
    isSystemOperation,

    fallbackLocale: (locale?: string) => locale || event.locals.locale || defaultLocale,

    versionQuery: (params, intent = 'read') => versionsReadQuery({ config, params, intent }),

    blank: () => createBlankDocument(config, event),

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
 * It has to *re-enter* this builder — a system call is the same API over a different context, not
 * a mutable flag on a shared object. `system(false)` hands back the API it was called on, which is
 * what lets `system(someBoolean)` read as "escalate if needed".
 */
const build = <Doc extends GenericDoc>(
  args: AreaApiArgs,
  isSystemOperation = false
): AreaApi<Doc> => {
  const api = shape<Doc>(context({ ...args, isSystemOperation })) as AreaApi<Doc>;
  api.system = (isSystem = true) => (isSystem ? build<Doc>(args, true) : api);
  return api;
};

/**
 * Everything `rime.area('settings')` hands back: two operations, a config and a blank.
 *
 * There is no `create` and no `delete` — not because they are switched off somewhere, but
 * because a singleton has no second document to make and nothing left to read if its only one
 * goes. Nor is there an id anywhere in these signatures. That is what "singleton" buys, and it
 * is why this is a separate definition rather than a collection with a flag.
 *
 * The whole surface is here, `config` and `blank` included; only `system` is composed on, by
 * `system` is composed on by `build` below, because it has to re-enter that builder.
 */
const shape = <Doc extends GenericDoc>(ctx: Ctx) => ({
  /** The built config this API acts on. */
  config: ctx.config,

  /** A document of this area's shape with every default applied. */
  blank: ctx.blank as () => Doc,

  /**
   * Retrieves the area's document
   *
   * - For non-versioned areas: Returns the single document
   * - For versioned areas without draft support: Returns the latest version by default, or a
   *   specific version if versionId is provided
   * - For versioned areas with draft support:
   *   - If versionId is provided: Returns that specific version
   *   - If draft=true: Returns the latest version (regardless of status)
   *   - If draft=false: Returns the published version
   *
   * @example
   * const doc = await rime.area('settings').find({ locale })
   * const doc = await rime.area('settings').find({ versionId: '123' })
   * const doc = await rime.area('settings').find({ draft: true })
   */
  find(args: FindArgs = {}): Promise<Doc> {
    const { locale, select = [], depth = 0, versionId, draft } = args;

    // As on a collection's find: the key holds the caller's locale, not the resolved one.
    return ctx.cached('area.find', { select, versionId, depth, draft, locale }, () =>
      find<Doc>({
        ctx,
        select,
        versionId,
        depth,
        draft,
        locale: ctx.fallbackLocale(locale)
      })
    );
  },

  /**
   * Updates the area's document
   *
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
  update(args: UpdateArgs<Doc>): Promise<Doc> {
    const { data, locale, versionId, draft } = args;

    return update<Doc>({
      ctx,
      data,
      versionId,
      draft,
      locale: ctx.fallbackLocale(locale)
    });
  }
});

/** Builds an area's API for one request. What `rime.area(slug)` calls. */
export const areaApi = <Doc extends GenericDoc>(args: AreaApiArgs): AreaApi<Doc> =>
  build<Doc>(args);

/** What `rime.area(slug)` hands back. See the note on `CollectionApi` about the context. */
export type AreaApi<Doc extends GenericDoc = GenericDoc> = ReturnType<typeof shape<Doc>> & {
  system(isSystem?: boolean): AreaApi<Doc>;
};

export type AreaAccessor = <Slug extends keyof RegisterArea>(
  slug: Slug
) => AreaApi<RegisterArea[Slug]>;
