import { defineParams } from '@sveltejs/kit/params';
import { params as rime } from './lib/+rime.generated/params.ts';

/**
 * This fixture's src/params.ts: rime's matchers plus `news`, for its
 * `(front)/[parentSlug=news]` route.
 *
 * rime generates the `panel`, `collection` and `area` matchers, and `locale` for a config with
 * locales, so a route that names any other matcher — as a consumer app's own front-end routes
 * freely may — has to declare it here, next to rime's. Without it SvelteKit cannot build the route manifest and *every*
 * request 500s, the dev server included.
 */
export const params = defineParams({
  ...rime,
  news: (param) => (param === 'news' ? param : undefined)
});
