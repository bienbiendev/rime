import { access } from '#lib/core/auth/access.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { answerLock } from '#lib/core/prototype/shared/metas/lock-answer.server.js';
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
 * `updatedBy` alone and cuts no version. Only staff may call it, since the lock names a staff
 * member; the update access below decides which documents.
 */
const run = (intent: 'claim' | 'release') =>
  endpoint(async ({ event, collection }) => {
    const { user } = event.locals;
    const id = event.params.id;

    if (!user || !access.isStaff(user)) throw new RimeError(RimeError.UNAUTHORIZED);
    if (!id) throw new RimeError(RimeError.NOT_FOUND);
    if (!collection.config.access.update(user, { event, id })) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    // Past the access check above, so `system()`: the lock sits on a document this caller may
    // write, and reading it back is not a second permission question.
    //
    // The row on the caller's screen when they name one, else the newest: a lock is held on the
    // version being edited, and an auto-saved row is only ever reached by its `versionId`.
    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const doc = await collection.system().findById({ id, versionId, latest: true });

    return answerLock({ event, intent, config: collection.config, doc, userId: user.id });
  });

export const restLock = run('claim');
export const restUnlock = run('release');
