import { access } from '#lib/core/auth/access.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { answerLock } from '#lib/core/prototype/shared/metas/lock-answer.server.js';
import { endpoint } from './endpoint.server.js';

/** The edit lock on an area: POST to take it, DELETE to give it back. */
const run = (intent: 'claim' | 'release') =>
  endpoint(async ({ event, area }) => {
    const { user } = event.locals;

    if (!user || !access.isStaff(user)) throw new RimeError(RimeError.UNAUTHORIZED);
    if (!area.config.access.update(user, { event })) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    // Past the access check above, so `system()`. The row on the caller's screen when they name
    // one, else the newest: a lock is held on the version being edited.
    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const doc = await area.system().find({ versionId, latest: true });

    return answerLock({ event, intent, config: area.config, doc, userId: user.id });
  });

export const restLock = run('claim');
export const restUnlock = run('release');
