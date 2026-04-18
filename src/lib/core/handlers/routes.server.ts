import buildNavigation from '$lib/panel/navigation.js';
import { type Handle } from '@sveltejs/kit';

export const handleRoutes: Handle = async ({ event, resolve }) => {
  const { rime, user } = event.locals;

  const isSignInRoute = event.url.pathname === '/panel/sign-in';
  const isPanelRoute = event.url.pathname.startsWith('/panel') && !isSignInRoute;

  // build panel navigation
  if (isPanelRoute && event.request.method === 'GET') {
    event.locals.routes = buildNavigation(rime.config.raw, user);
  }

  // Handle custom routes from config and plugins
  const routes =
    '$routes' in rime.config.raw ? (rime.config.raw.$routes as Record<string, any>) : null;

  if (routes && event.url.pathname in routes) {
    const route = routes[event.url.pathname];
    type RequestMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE';
    const method: RequestMethod = event.request.method as RequestMethod;
    if (method in route && !!route[method]) {
      return route[method](event);
    }
  }

  return resolve(event);
};
