import type { BuildConfig } from '#lib/core/config/index.server.js';
import type { Config } from '#lib/types.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Route } from '../../panel/types.js';

/**
 * Builds the panel navigation groups: the collections and areas the request's user may read, then
 * the custom panel routes.
 * @param config - the built config.
 * @param event - the request; gives the user and `rime.routes.panelUrl`.
 * @returns the routes, by group.
 */
const buildNavigation = <C extends Config>(config: BuildConfig<C>, event: RequestEvent): Dic => {
  const groups: Dic = {};
  const { user, rime } = event.locals;
  /**
   * Adds a route to its navigation group. A route without one goes to `none`, which the sidebar
   * lists under the Dashboard link.
   */
  const addRouteToGroup = (route: Route, group = 'none') => {
    groups[group] ??= [];
    groups[group].push(route);
  };

  // Process collections
  config.collections
    .filter((collection) => collection.panel !== false)
    .forEach((collection) => {
      if (user && collection.access.read(user, {})) {
        const route: Route = {
          title: collection.label.plural,
          icon: collection.slug,
          url: rime.routes.panelUrl(collection.kebab)
        };
        addRouteToGroup(route, (collection.panel && collection.panel?.group) || 'collections');
      }
    });

  // Process areas
  config.areas
    .filter((area) => area.panel !== false)
    .forEach((area) => {
      if (user && area.access.read(user, {})) {
        const route: Route = {
          title: area.label,
          icon: area.slug,
          url: rime.routes.panelUrl(area.kebab)
        };
        addRouteToGroup(route, (area.panel && area.panel?.group) || 'areas');
      }
    });

  // Process custom panel routes
  Object.entries(config.panel.routes).forEach(([routePath, routeConfig]) => {
    const route: Route = {
      title: routeConfig.label,
      icon: `custom-${routePath}`,
      url: rime.routes.panelUrl(routePath)
    };
    addRouteToGroup(route, routeConfig.group);
  });

  return groups;
};

export default buildNavigation;

export type Navigation = ReturnType<typeof buildNavigation>;
