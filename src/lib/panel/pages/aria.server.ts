import type { Route } from '#lib/panel/types.js';

/** The first crumb of every panel page. The breadcrumb shows it on the dashboard only. */
export const dashboardCrumb = (rime: { routes: { panelUrl: () => string } }): Route => ({
  title: 'Dashboard',
  icon: 'dashboard',
  url: rime.routes.panelUrl()
});
