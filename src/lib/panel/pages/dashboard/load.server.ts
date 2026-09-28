import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import type { AreaSlug } from '$lib/core/prototype/types.js';
import { capitalize } from '$lib/util/string.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { BuiltCollection, Route } from '../../../types.js';
import type { DashboardEntry } from './types.js';

type CollectionEntry = Extract<DashboardEntry, { prototype: 'collection' }>;

export const dashboardLoad = async (event: ServerLoadEvent) => {
  const { locale, user, rime } = event.locals;

  const entries: DashboardEntry[] = [];

  /**
   * The dashboard's own defaults — and the only place they live.
   *
   * `panel !== false` is already filtered below, so `c.panel` here is either what the author wrote
   * or nothing at all. Layout precedence, widest to narrowest: what the author put on the
   * collection, then what a feature offered through `_dashboardLayout` (`upload` asks for a grid),
   * then rows. The author's `maxEntries` wins, else 3 rows or 4 grid items.
   */
  const normalizedPanelConfig = (c: BuiltCollection) => {
    const incomingConfig = c.panel || {};
    const incomingDashboardConfig = incomingConfig.dashboard || {};
    const layout = incomingDashboardConfig.layout ?? c._dashboardLayout ?? 'rows';
    return {
      ...incomingConfig,
      dashboard: {
        layout,
        maxEntries: incomingDashboardConfig.maxEntries || (layout === 'grid' ? 4 : 3)
      }
    };
  };

  const buildBaseEntry = (c: BuiltCollection): CollectionEntry => {
    const panelConfig = normalizedPanelConfig(c);
    return {
      prototype: 'collection',
      description: panelConfig.description || null,
      slug: c.slug,
      canCreate: user && c.access.create(user, {}),
      link: rime.routes.panelUrl(c.kebab),
      titleSingular: c.label.singular,
      title: c.label.plural,
      layout: panelConfig.dashboard.layout
    };
  };

  const getLastEdited = async (c: BuiltCollection, limit: number) => {
    try {
      return await rime.collection(c.slug).find({
        limit,
        locale,
        latest: true
      });
    } catch (err: any) {
      console.error(`Error fetching documents for collection ${c.slug}:`);
      console.error(err);
      return [];
    }
  };

  /** How many documents a collection holds, and how many of them wait as drafts. */
  const countDocuments = async (c: BuiltCollection) => {
    try {
      const docs = await rime.collection(c.slug).find({ locale, latest: true, select: ['status'] });
      const drafts = c.versions?.draft
        ? docs.filter((doc) => doc.status === VERSIONS_STATUS.DRAFT).length
        : 0;
      return { count: docs.length, drafts };
    } catch (err: any) {
      console.error(`Error counting documents of collection ${c.slug}:`);
      console.error(err);
      return { count: null, drafts: 0 };
    }
  };

  const promiseEntries = rime.config.raw.collections
    .filter((collection) => user && collection.access.read(user, {}))
    .filter((collection) => collection.panel !== false && collection.panel?.dashboard !== false)
    // Every collection left wants its latest documents listed, and counted.
    .map(async (collection): Promise<CollectionEntry> => {
      const [docs, counts] = await Promise.all([
        getLastEdited(collection, normalizedPanelConfig(collection).dashboard.maxEntries),
        countDocuments(collection)
      ]);
      return { ...buildBaseEntry(collection), lastEdited: docs, ...counts };
    });

  /** When an area was last saved, or `null` when it cannot say. */
  const lastUpdate = async (slug: AreaSlug) => {
    try {
      const doc = await rime.area(slug).find({ locale, latest: true, select: ['updatedAt'] });
      return doc?.updatedAt ?? null;
    } catch {
      return null;
    }
  };

  try {
    const collectionEntries = await Promise.all(promiseEntries);
    entries.push(...collectionEntries);
  } catch (err: any) {
    console.error('Error retrieving collection entries:');
    console.error(err);
  }

  const areas = rime.config.raw.areas.filter(
    (area) => area.panel !== false && user && area.access.read(user, {})
  );
  const areaEntries = await Promise.all(
    areas.map(async (area): Promise<DashboardEntry> => ({
      prototype: 'area',
      description: (area.panel && area.panel?.description) || null,
      slug: area.slug,
      link: rime.routes.panelUrl(area.kebab),
      title: area.label || capitalize(area.slug),
      updatedAt: await lastUpdate(area.slug)
    }))
  );
  entries.push(...areaEntries);

  const aria: Route[] = [{ title: 'Dashboard', icon: 'dashboard', url: rime.routes.panelUrl() }];

  return { entries, aria };
};
