import { logger } from '#lib/core/logger.server.js';
import { fail, type ActionFailure } from '@sveltejs/kit';
import type { HandleServerError } from '@sveltejs/kit/hooks';
import { APIError } from 'better-auth/api';
import { RimeError, RimeFormError } from './index.js';

/**
 * SvelteKit's `handleError`, re-exported by the app's `src/hooks.server.ts`. Every error a request
 * throws ends here: endpoints, loads, actions, rendering, the `handle` hooks. So nothing in rime
 * catches an error to answer it, it throws:
 *
 * ```ts
 * if (!doc) throw new RimeError(RimeError.NOT_FOUND);
 * ```
 *
 * A `RimeError` or a better-auth `APIError` answers with its own status and message.
 * Anything else is a 500 whose message stays on the server, logged with its stack. An `error()`
 * already has its status, and SvelteKit answers it as is.
 */
export const handleError: HandleServerError = ({ error, event, kind }) => {
  if (kind !== 'unknown') return;

  const line = `${event.request.method} ${event.url.pathname}`;

  if (error instanceof RimeError) {
    if (error.status >= 500) {
      logger.error(`${error.status} ${line}\n${error.stack}`);
    } else {
      logger.debug(`${error.status} ${line} — ${error.message}`);
    }
    return { status: error.status, message: error.message };
  }

  if (error instanceof APIError) {
    const message = `${error.body?.message || error.message || error.status}`;
    logger.debug(`${error.statusCode} ${line} — ${message}`);
    return { status: error.statusCode, message };
  }

  logger.error(`500 ${line}\n${error instanceof Error ? error.stack : String(error)}`);
};

/**
 * A form action's error: what the form can show comes back as a failure, anything else is thrown
 * on to `handleError`. The failure carries the submitted values, except for a generic better-auth
 * error, which sends an empty form.
 *
 * ```ts
 * const [error] = await trycatch(() => save(data));
 * if (error) return formFailure(error, data);
 * ```
 */
export function formFailure(error: Error, form: Record<string, any> = {}): ActionFailure<any> {
  if (error instanceof RimeFormError) {
    return fail(400, { form, errors: error.errors });
  }

  if (error instanceof APIError) {
    if (error.body?.code === 'USER_ALREADY_EXISTS') {
      return fail(400, { form, errors: { email: RimeFormError.UNIQUE_FIELD } });
    }
    const message = `${error.body?.message || error.message || error.status}`;
    return fail(error.statusCode, { form: {}, errors: { _form: message } });
  }

  throw error;
}
