import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Matcher for this fixture's `(front)/[parentSlug=news]` route.
 *
 * rime only ever generates the `panel`, `collection` and `area` matchers, so a route that
 * names any other matcher — as a consumer app's own front-end routes freely may — has to ship
 * it alongside the route, exactly like this. Without it SvelteKit cannot build the route
 * manifest and *every* request 500s, the dev server included.
 */
export const match: ParamMatcher = (param) => param === 'news';
