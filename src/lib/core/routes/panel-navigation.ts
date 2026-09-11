import type { BuildConfig } from '$lib/core/config/index.server.js';
import type { Config } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Route } from '../../panel/types.js';

/**
 * Builds navigation structure based on config and user permissions. Called
 * directly from the routes handle hook, before resolve() — page.params isn't
 * populated yet at that point, so the panel segment is passed in explicitly
 * (from the same event.params.panel the caller already has) rather than
 * relying on panelUrl()'s page-based default.
 * @param config - Compiled configuration object
 * @param user - Current user object (optional)
 * @param panelSegment - The resolved [panel=panel] segment for this request
 * @returns Dictionary of navigation groups
 */
const buildNavigation = <C extends Config>(config: BuildConfig<C>, event: RequestEvent): Dic => {
  const groups: Dic = {};
  const { user, rime } = event.locals;
  /**
   * Adds a route to the appropriate navigation group
   */
  const addRouteToGroup = (route: Route, group?: string) => {
    if (group) {
      if (!(group in groups)) {
        groups[group] = [];
      }
      groups[group].push(route);
    } else {
      groups.none.push(route);
    }
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
  config.areas.forEach((area) => {
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
