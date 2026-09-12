import { PARAMS } from '$lib/core/constants.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { claimEditLock, releaseEditLock } from '$lib/core/prototype/shared/metas/lock.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/** The edit lock on an area — see the collection's, which this mirrors without the `[id]` tier. */
const run = (intent: 'claim' | 'release') =>
  endpoint(async ({ event, area }) => {
    const { user } = event.locals;

    if (!user) return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: 'api' });
    if (!area.config.access.update(user, {})) {
      return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: 'api' });
    }

    // The row on the caller's screen when they name one, else the newest — see the collection's.
    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const [readError, doc] = await trycatch(() => area.system().find({ versionId, draft: true }));
    if (readError) return handleError(readError, { context: 'api' });

    // A `pagehide` beacon can only POST, so a release arriving that way says so in the query.
    // DELETE stays the method for every release that has time to pick one.
    const releasing = intent === 'release' || event.url.searchParams.get('release') === 'true';
    const force = !releasing && event.url.searchParams.get('force') === 'true';
    const args = { event, config: area.config, doc, userId: user.id, force };

    const [error, held] = await trycatch(async () => {
      if (releasing) {
        await releaseEditLock(args);
        return false;
      }
      return claimEditLock(args);
    });
    if (error) return handleError(error, { context: 'api' });

    return json({ held: !!held });
  });

export const restLock = run('claim');
export const restUnlock = run('release');
