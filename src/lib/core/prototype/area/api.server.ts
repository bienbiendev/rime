import type { BuiltArea } from '$lib/core/factory/config/types.js';
import type { RegisterArea } from '$lib/index.js';
import type { PrototypeApi, PrototypeApiContext } from '../define.js';
import type { GenericDoc } from '../types.js';
import { find, type FindArgs } from './operations/find.js';
import { update, type UpdateArgs } from './operations/update.js';

type Ctx = PrototypeApiContext<BuiltArea>;

/**
 * The local API an area provides: exactly two operations.
 *
 * There is no `create` and no `delete` — not because they are switched off somewhere, but
 * because a singleton has no second document to make and nothing left to read if its only one
 * goes. Nor is there an id anywhere in these signatures. That is what "singleton" buys, and it
 * is why this is a separate definition rather than a collection with a flag.
 */
export const api = <Doc extends GenericDoc>(ctx: Ctx) => ({
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

/** What `rime.area(slug)` hands back. See the note on `CollectionApi` about the context. */
export type AreaApi<Doc extends GenericDoc = GenericDoc> = PrototypeApi<
  ReturnType<typeof api<Doc>>,
  Doc
> & { config: BuiltArea };

export type AreaAccessor = <Slug extends keyof RegisterArea>(
  slug: Slug
) => AreaApi<RegisterArea[Slug]>;
