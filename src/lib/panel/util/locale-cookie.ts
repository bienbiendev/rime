import { invalidateAll } from '$app/navigation';
import { panelPath } from '#lib/core/routes/util.js';
import Cookies from 'js-cookie';

/**
 * Moves the panel to another locale: the `rime.locale` cookie, then a reload of the page data.
 * The cookie's path is the panel's, so the browser sends it to panel pages only, never to the
 * site or to /api. It is `Secure` on https only: a browser drops a `Secure` cookie set over http.
 *
 * ```ts
 * switchLocale('en'); // rime.locale=en; Path=/panel
 * ```
 */
export function switchLocale(code: string) {
  Cookies.set('rime.locale', code, {
    path: panelPath(),
    sameSite: 'strict',
    secure: location.protocol === 'https:'
  });
  return invalidateAll();
}
