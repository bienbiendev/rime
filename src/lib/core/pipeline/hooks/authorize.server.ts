import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger.server.js';

/**
 * Runs the config's own access check for this operation, and throws `UNAUTHORIZED` if it says no.
 *
 * A system call stands down — `rime.collection('x').system()` is rime asking itself.
 */
export const authorize = Hooks.beforeOperation(async function authorize(args) {
  const { config, event, operation, context } = args;
  let authorized = false;

  const params = {
    event,
    id: context.params.id
  };

  if (args.context.isSystemOperation) return args;

  switch (operation) {
    case 'create':
      authorized = config.access.create(event.locals.user, params);
      break;
    case 'read':
      authorized = config.access.read(event.locals.user, params);
      break;
    case 'update':
      authorized = config.access.update(event.locals.user, params);
      break;
    case 'delete':
      authorized = config.access.delete(event.locals.user, params);
      break;
  }

  if (!authorized) {
    logger.error(RimeError.UNAUTHORIZED);
    throw new RimeError(RimeError.UNAUTHORIZED);
  }
  return args;
});
