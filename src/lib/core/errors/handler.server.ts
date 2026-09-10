import { getRequestEvent } from '$app/server';
import { logger } from '$lib/core/logger.server.js';
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { RimeError, RimeFormError } from './index.js';

export const ERROR_CONTEXT = {
  ACTION: 'action',
  API: 'api',
  LOAD: 'load'
} as const;

export type ErrorContext = (typeof ERROR_CONTEXT)[keyof typeof ERROR_CONTEXT];

type ErrorHandlerOptions = {
  context: ErrorContext;
  formData?: Record<string, any>; // For actions
};

/**
 * Only called at the route boundary: +server.ts handlers, load functions,
 * form actions. Everywhere else, just `throw new RimeError(...)` (centralizes
 * error codes/messages) — it bubbles up and gets caught here, where `context`
 * tells this function which SvelteKit primitive to translate it into:
 * `error()` (api/load), `redirect()`, or `fail()` (action form errors).
 *
 * Always call it as `return handleError(...)`. Most branches throw internally
 * (`error`/`redirect`), so `return` never runs — but the `fail()` branch (form
 * errors in actions) is a real return value, so `return` is required there.
 *
 * @example +server.ts endpoint
 * if (!id) return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
 *
 * @example load function
 * const [err, doc] = await trycatch(() => getDoc(id));
 * if (err) return handleError(err, { context: ERROR_CONTEXT.LOAD });
 *
 * @example form action
 * const [err] = await trycatch(() => save(data));
 * if (err) return handleError(err, { context: ERROR_CONTEXT.ACTION, formData: data });
 */
/**
 * Every branch below either throws — `error()` and `redirect()` are declared `never` — or, in an
 * action context only, returns `fail()`. So the return type depends entirely on the context, and
 * the overloads say so: an api/load call contributes nothing to its caller's return type, which
 * is what lets a `+server.ts` handler be a real `RequestHandler` while still ending
 * `return handleError(...)`.
 *
 * Inferred as one union instead, every REST handler in the repo was typed as possibly returning
 * an `ActionFailure`, which no api-context call can produce.
 */
export function handleError(
  err: Error,
  options: ErrorHandlerOptions & { context: typeof ERROR_CONTEXT.ACTION }
): ReturnType<typeof handleErrorImpl>;
export function handleError(
  err: Error,
  options: ErrorHandlerOptions & { context: typeof ERROR_CONTEXT.API | typeof ERROR_CONTEXT.LOAD }
): never;
export function handleError(err: Error, options: ErrorHandlerOptions) {
  return handleErrorImpl(err, options);
}

function handleErrorImpl(err: Error, options: ErrorHandlerOptions) {
  const { context, formData } = options;

  /****************************************************/
  /* FormError Errors
	/****************************************************/
  if (err instanceof RimeFormError) {
    switch (context) {
      case ERROR_CONTEXT.ACTION:
        // fail() returns an ActionFailure — lets SvelteKit re-render the form
        // with `errors`/`form` instead of navigating to the error boundary.
        return fail(400, {
          form: formData || {},
          errors: err.errors
        });
      case ERROR_CONTEXT.API:
        return error(400, err.message);
    }
  }

  /****************************************************/
  /* Rime Errors
	/****************************************************/
  if (err instanceof RimeError) {
    if (err.code === RimeError.NOT_FOUND && context === ERROR_CONTEXT.LOAD) {
      const event = getRequestEvent();
      logger.error(`404 - ${err.message} - ${event.url.href}`);
      throw error(404, event.url.href + ' : ' + err.message);
    }
    const logMessage = err.message ? `${err.status} — ${err.message}` : err.status;
    logger.error(logMessage);
    return error(err.status, err.message);
  }

  // Redirect error
  if (isRedirect(err)) {
    return redirect(err.status, err.location);
  }

  /****************************************************/
  /* Handle BetterAuth error
	/****************************************************/
  if (err instanceof APIError) {
    if (err.body?.code === 'USER_ALREADY_EXISTS') {
      switch (context) {
        case ERROR_CONTEXT.ACTION:
          return fail(400, {
            form: formData || {},
            errors: {
              email: RimeFormError.UNIQUE_FIELD
            }
          });
        case ERROR_CONTEXT.API:
          logger.debug(`400 — ${err.body.message}`);
          return error(400, err.message);
      }
    }

    const message = `${err.body?.message || err.message || err.status}`;
    logger.debug(err);

    switch (context) {
      case ERROR_CONTEXT.ACTION:
        return fail(err.statusCode, {
          form: {},
          errors: {
            _form: message
          }
        });

      case ERROR_CONTEXT.API:
        logger.debug(`400 — ${message}`);
        return error(400, message);
    }
  }

  // Unknown errors
  console.error(err);
  const event = getRequestEvent();
  const logMessage = err.message
    ? `500 - ${event.url.href} - ${err.message}`
    : `500 - ${event.url.href}`;
  logger.error(logMessage);
  return error(500, 'Internal Server Error');
}
