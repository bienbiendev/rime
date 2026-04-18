import { redirect, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Check and handle live edit redirect if needed.
 * @throws {Redirect} If live=1 and user is authenticated
 */
export function checkLiveRedirect(doc: { _live?: string }, event: ServerLoadEvent): void {
  const { user } = event.locals;
  if (user && doc._live && event.url.searchParams.get('live') === '1') {
    throw redirect(302, doc._live);
  }
}
