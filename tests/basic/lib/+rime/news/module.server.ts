import { SITE_URL } from '$app/env/public';

/** A news item's address on the site: `/news/<slug>`, the `(front)/[parentSlug=news]` route. */
export const buildNewsUrl = ({ slug }: { slug: string }) => `${SITE_URL}/news/${slug}`;
