import { redirect, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Redirects to the document's live editor.
 * @throws {Redirect} When the visitor is staff, the document has a `_live` url and the url asks
 * for `live=1`.
 */
export function checkLiveRedirect(doc: { _live?: string }, event: ServerLoadEvent): void {
  const { user } = event.locals;
  if (user?.isStaff && doc._live && event.url.searchParams.get('live') === '1') {
    throw redirect(302, doc._live);
  }
}
