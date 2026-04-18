import { panelUrl } from '$lib/panel/util/url.js';
import { capitalize } from '$lib/util/string.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { BuiltCollection, Route } from '../../../types.js';
import type { DashboardEntry } from './types.js';

export const dashboardLoad = async (event: ServerLoadEvent) => {
  const { locale, user, rime } = event.locals;

  const entries: DashboardEntry[] = [];

  const buildBaseEntry = (c: BuiltCollection): DashboardEntry => ({
    prototype: 'collection',
    description: c.panel && c.panel?.description ? c.panel.description : null,
    slug: c.slug,
    canCreate: user && c.access.create(user, {}),
    link: panelUrl(c.kebab),
    titleSingular: c.label.singular,
    title: c.label.plural
  });

  const getLastEdited = async (c: BuiltCollection) => {
    try {
      return await rime.collection(c.slug).find({
        limit: 6,
        locale
      });
    } catch (err: any) {
      console.error(`Error fetching documents for collection ${c.slug}:`);
      console.error(err);
      return [];
    }
  };

  const promiseEntries = rime.config.raw.collections
    .filter((collection) => user && collection.access.read(user, {}))
    .filter((collection) => collection.panel !== false)
    .map(async (collection) => {
      if (collection.panel) {
        return getLastEdited(collection).then((docs) => ({
          ...buildBaseEntry(collection),
          lastEdited: docs
        }));
      } else {
        return {
          ...buildBaseEntry(collection),
          lastEdited: []
        };
      }
    });

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
        link: panelUrl(area.kebab),
        title: area.label || capitalize(area.slug)
      });
    }
  }

  const aria: Route[] = [{ title: 'Dashboard', icon: 'dashboard', url: panelUrl() }];

  return { entries, aria };
};
