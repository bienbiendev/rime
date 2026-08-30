import { page } from '$app/state';
import { env } from '$env/dynamic/public';

/**
 * Build a panel url for given segments. Reads the current panel segment off
 * the live matched route (page.params.panel, resolved by the [panel=panel]
 * matcher) rather than from a public env var — the segment can be configured
 * via RIME_PANEL_ROUTE to hide the panel from admin-path scanners, and that
 * would be defeated by shipping it into every page's public env bundle.
 *
 * Only call this from actual component rendering (.svelte files, or a
 * .svelte.ts context set up during component init) — page.params is bound to
 * the current request via component context and SvelteKit throws if it's read
 * anywhere else, including a +page.server.ts/+layout.server.ts load function
 * or a form action, even though those also run server-side. Every load/action
 * function in this codebase already receives an `event` with `event.params.panel`
 * populated the same way — use panelUrlFor(event.params.panel, ...) there instead.
 * @example
 * panelUrl('some-collection') // -> http://localhost:5713/panel/some-collection
 */
export function panelUrl(...args: string[]) {
  return panelUrlFor(page.params.panel, ...args);
}

/**
 * Same as panelUrl(), but takes the panel segment explicitly instead of
 * reading it off page.params — for any caller that isn't component rendering:
 * every +page.server.ts/+layout.server.ts load function and form action
 * (pass event.params.panel), plus the one hook-level caller that runs before
 * resolve() (buildNavigation(), which gets it forwarded from routes.server.ts).
 */
export function panelUrlFor(panelSegment: string | undefined, ...args: string[]) {
  return `${env.PUBLIC_RIME_URL}/${panelSegment}/${args.join('/')}`;
}

/**
 * Same as panelUrl(), but returns a same-origin-relative path instead of an
 * absolute URL — for goto()/form-action targets where PUBLIC_RIME_URL isn't
 * guaranteed to match the actual origin the page was served from (a reverse
 * proxy, differing dev host, etc). Everywhere else (real cross-page <a href>
 * links, window.location.href, emailed reset links) stays absolute, matching
 * apiUrl()'s existing convention.
 */
export function panelPath(...args: string[]) {
  return `/${page.params.panel}/${args.join('/')}`;
}
