import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { claimEditLock, releaseEditLock } from '$lib/core/prototype/shared/metas/lock.server.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import { trycatch } from '$lib/util/function.js';
import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';

/**
 * The form actions that keep an edit lock alive, and the one that hands it back.
 *
 * Panel actions rather than REST routes, because the lock never leaves the panel —
 * `buildDocument` strips it from every other read — so there is no public endpoint that can set
 * it. The open document's heartbeat and *Take control* both come through here.
 *
 * Neither goes near the write pipeline: `claimEditLock`/`releaseEditLock` set the two lock columns
 * through the adapter's `updateWhere`, so holding a document leaves `updatedAt` and `updatedBy`
 * alone and cuts no version.
 *
 * A claim answers `{ held }` rather than failing when somebody else has the document. The caller
 * is a heartbeat, and "you lost it" is an ordinary answer for it to render, not an error.
 *
 * `force` on a claim is *Take control*: the overlay's whole purpose is to offer a way past a lock
 * somebody left behind, so that one button has to override a claim the rest of the flow respects.
 */
type Resolve = (event: RequestEvent) => {
  config: BuiltCollection | BuiltArea;
  /** The base row the lock sits on. */
  read: () => Promise<GenericDoc>;
};

export const editLockActions = (resolve: Resolve): Actions => ({
  lock: (event: RequestEvent) => runLock(event, resolve, 'claim'),
  unlock: (event: RequestEvent) => runLock(event, resolve, 'release')
});

const runLock = async (event: RequestEvent, resolve: Resolve, intent: 'claim' | 'release') => {
  const { user } = event.locals;
  if (!user) {
    return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: ERROR_CONTEXT.ACTION });
  }

  const [resolveError, target] = await trycatch(async () => {
    const resolved = resolve(event);
    return { config: resolved.config, doc: await resolved.read() };
  });

  if (resolveError) {
    return handleError(resolveError, { context: ERROR_CONTEXT.ACTION });
  }

  const { config, doc } = target;

  if (!config.access.update(user, { id: doc.id })) {
    return handleError(new RimeError(RimeError.UNAUTHORIZED), { context: ERROR_CONTEXT.ACTION });
  }

  const force = intent === 'claim' && (await event.request.formData()).get('force') === 'true';
  const args = { event, config, userId: user.id, doc, force };

  const [error, held] = await trycatch(() =>
    intent === 'claim' ? claimEditLock(args) : releaseEditLock(args).then(() => false)
  );

  if (error) {
    return fail(500, { held: false });
  }

  return { held };
};
