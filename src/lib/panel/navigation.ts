import type { User } from '$lib/core/features/auth/types.js';
import type { BuildConfig } from '$lib/core/config/index.server.js';
import type { Config } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import type { Route } from './types.js';
import { panelUrlFor } from './util/url.js';

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
const buildNavigation = <C extends Config>(
  config: BuildConfig<C>,
  user: User | undefined,
  panelSegment: string | undefined
): Dic => {
  const groups: Dic = {};

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
          url: panelUrlFor(panelSegment, collection.kebab)
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
        url: panelUrlFor(panelSegment, area.kebab)
      };
      addRouteToGroup(route, (area.panel && area.panel?.group) || 'areas');
    }
  });

  // Process custom panel routes
  Object.entries(config.panel.routes).forEach(([routePath, routeConfig]) => {
    const route: Route = {
      title: routeConfig.label,
      icon: `custom-${routePath}`,
      url: panelUrlFor(panelSegment, routePath)
    };
    addRouteToGroup(route, routeConfig.group);
  });

  return groups;
};

export default buildNavigation;

export type Navigation = ReturnType<typeof buildNavigation>;
