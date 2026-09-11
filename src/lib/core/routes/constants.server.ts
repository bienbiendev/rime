import { isValidSlug } from '$lib/util/string.js';

/** The panel's URL segment (e.g. "panel" -> /panel/...). Kept as a bare segment, never a
 * PUBLIC_-prefixed env var: SvelteKit ships every PUBLIC_ value into the JS bundle of every
 * page (including the public site), which would defeat the point of letting an operator hide
 * this path from automated CMS-admin scanners. */
export const PANEL_ROUTE = (process.env.RIME_PANEL_ROUTE || 'panel').replace(/^\/+|\/+$/g, '');

if (!isValidSlug(PANEL_ROUTE)) {
  throw new Error(
    `RIME_PANEL_ROUTE must be a single URL segment (letters, numbers, "_"/"-", starting with a letter) — got "${PANEL_ROUTE}"`
  );
}
