import { panelUrlFor } from '$lib/panel/util/url.js';
import { capitalize } from '$lib/util/string.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { BuiltCollection, Route } from '../../../types.js';
import type { DashboardEntry } from './types.js';

export const dashboardLoad = async (event: ServerLoadEvent) => {
  const { locale, user, rime } = event.locals;
  const panelSegment = event.params.panel;

  const entries: DashboardEntry[] = [];

  /**
   * The dashboard's own defaults — and the only place they live.
   *
   * `panel !== false` is already filtered below, so `c.panel` here is either what the author wrote
   * or nothing at all. Layout precedence, widest to narrowest: what the author put on the
   * collection, then what a feature offered through `_dashboardLayout` (`upload` asks for a grid),
   * then rows.
   *
   * The collection prototype used to seed all of this in an `configurePanel`, which meant `panel`
   * was always an object by the time it got here — so `panel: false` never survived to be read,
   * and these defaults ran twice.
   */
  const normalizedPanelConfig = (c: BuiltCollection) => {
    const incomingConfig = c.panel || {};
    const incomingDashboardConfig = incomingConfig.dashboard || {};
    return {
      ...incomingConfig,
      dashboard: {
        layout: incomingDashboardConfig.layout ?? c._dashboardLayout ?? 'rows',
        maxEntries: incomingDashboardConfig.maxEntries || 8
      }
    };
  };

  const buildBaseEntry = (c: BuiltCollection): DashboardEntry => {
    const panelConfig = normalizedPanelConfig(c);
    return {
      prototype: 'collection',
      description: panelConfig.description || null,
      slug: c.slug,
      canCreate: user && c.access.create(user, {}),
      link: panelUrlFor(panelSegment, c.kebab),
      titleSingular: c.label.singular,
      title: c.label.plural,
      layout: panelConfig.dashboard.layout
    };
  };

  const getLastEdited = async (c: BuiltCollection, limit: number = 8) => {
    try {
      return await rime.collection(c.slug).find({
        limit,
        locale,
        draft: true
      });
    } catch (err: any) {
      console.error(`Error fetching documents for collection ${c.slug}:`);
      console.error(err);
      return [];
    }
  };

  const promiseEntries = rime.config.raw.collections
    .filter((collection) => user && collection.access.read(user, {}))
    .filter((collection) => collection.panel !== false && collection.panel?.dashboard !== false)
    // No `if (collection.panel)` branch: the filter above has already dropped the collections that
    // switched the panel or the dashboard off, so everything reaching here wants its documents
    // listed. The branch existed because `configurePanel` made `panel` unconditionally truthy, which
    // made its `else` unreachable — take the augment away and it would have started silently
    // emptying every collection that authored no `panel` at all.
    .map(async (collection) =>
      getLastEdited(collection, normalizedPanelConfig(collection).dashboard.maxEntries).then(
        (docs) => ({ ...buildBaseEntry(collection), lastEdited: docs })
      )
    );

  try {
    const collectionEntries = await Promise.all(promiseEntries);
    entries.push(...collectionEntries);
  } catch (err: any) {
    console.error('Error retrieving collection entries:');
    console.error(err);
  }

  for (const area of rime.config.raw.areas.filter((a) => a.panel !== false)) {
    if (user && area.access.read(user, {})) {
      entries.push({
        prototype: 'area',
        description: (area.panel && area.panel?.description) || null,
        slug: area.slug,
        link: panelUrlFor(panelSegment, area.kebab),
        title: area.label || capitalize(area.slug)
      });
    }
  }

  const aria: Route[] = [{ title: 'Dashboard', icon: 'dashboard', url: panelUrlFor(panelSegment) }];

  return { entries, aria };
};
