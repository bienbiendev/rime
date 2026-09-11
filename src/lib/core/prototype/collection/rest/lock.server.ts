import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { claimEditLock, releaseEditLock } from '$lib/core/prototype/shared/metas/lock.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * The edit lock on one document: POST to take it, DELETE to give it back.
 *
 * A route rather than a panel form action, because a prototype adds a route by declaring it in
 * `rest` and codegen writes the file — while a form action has to be listed by name in the
 * generated `+page.server.ts`, so one that is not listed answers 404 and every claim quietly does
 * nothing.
 *
 * Neither method goes near the write pipeline: `claimEditLock`/`releaseEditLock` set the two lock
 * columns through the adapter's `updateWhere`, so holding a document leaves `updatedAt` and
 * `updatedBy` alone and cuts no version. The fields' own `.access({ update })` decides who may
 * call this at all; the update access below decides which documents.
 */
const run = (intent: 'claim' | 'release') =>
  endpoint(async ({ event, collection }) => {
    const { user } = event.locals;
    const id = event.params.id;

    if (!user) return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: 'api' });
    if (!id) return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
    if (!collection.config.access.update(user, { id })) {
      return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: 'api' });
    }

    // Past the access check above, so `system()`: the lock sits on a document this caller may
    // write, and reading it back is not a second permission question.
    const [readError, doc] = await trycatch(() =>
      collection.system().findById({ id, draft: true })
    );
    if (readError) return handleError(readError, { context: 'api' });

    // A `pagehide` beacon can only POST, so a release arriving that way says so in the query.
    // DELETE stays the method for every release that has time to pick one.
    const releasing = intent === 'release' || event.url.searchParams.get('release') === 'true';
    const force = !releasing && event.url.searchParams.get('force') === 'true';
    const args = { event, config: collection.config, doc, userId: user.id, force };

    const [error, held] = await trycatch(async () => {
      if (releasing) {
        await releaseEditLock(args);
        return false;
      }
      return claimEditLock(args);
    });
    if (error) return handleError(error, { context: 'api' });

    // `held` is the answer, not a failure: a heartbeat that lost the document has to render that,
    // so somebody else holding it is an ordinary 200.
    return json({ held: !!held });
  });

export const restLock = run('claim');
export const restUnlock = run('release');
