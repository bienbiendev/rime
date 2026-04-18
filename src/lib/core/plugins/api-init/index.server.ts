import { dev } from '$app/environment';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError, RimeFormError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import type { FormErrors } from '$lib/types.js';
import { trycatch, trycatchSync } from '$lib/util/function.js';
import { email as validateEmail, password as validatePassword } from '$lib/util/validate.js';
import { json, type RequestHandler } from '@sveltejs/kit';
import { definePlugin, type Plugin } from '../index.js';

export const apiInit = definePlugin(() => {
  const requestHandler: RequestHandler = async (event) => {
    if (!dev) throw new RimeError(RimeError.NOT_FOUND);

    const hasAuthUser = await event.locals.rime.adapter.auth.hasAuthUser();
    if (hasAuthUser || (!hasAuthUser && !dev)) {
      throw handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
    }

    const data = await extractData<Record<string, string>>(event.request);
    const [error] = trycatchSync(() => validateForm(data));

    if (error) {
      throw handleError(error, {
        context: 'action',
        formData: { email: data.email }
      });
    }

    event.locals.isInit = true;

    const [signUpError] = await trycatch(() =>
      event.locals.rime.auth.api.signUpEmail({
        body: {
          email: data.email,
          name: data.name,
          password: data.password,
          type: 'staff'
        }
      })
    );

    if (signUpError) {
      throw handleError(signUpError, {
        context: 'api',
        formData: { email: data.email }
      });
    }

    return json({ initialized: true });
  };

  return {
    name: 'apiInit',
    type: 'server',
    routes: {
      '/api/init': {
        POST: requestHandler
      }
    }
  } as const satisfies Plugin;
});

const validateForm = (
  data: Record<string, string>
): data is { email: string; name: string; password: string } => {
  const errors: FormErrors = {};
  const { name, email, password } = data;

  if (!email) {
    errors.email = RimeFormError.REQUIRED_FIELD;
  }
  if (!name) {
    errors.name = RimeFormError.REQUIRED_FIELD;
  }
  if (!password) {
    errors.password = RimeFormError.REQUIRED_FIELD;
  }

  const emailValidation = validateEmail(email);
  if (typeof emailValidation === 'string') {
    errors.email = RimeFormError.INVALID_FIELD;
  }

  if (typeof name !== 'string') {
    errors.name = RimeFormError.INVALID_FIELD;
  }

  const passwordValidation = validatePassword(password);
  if (typeof passwordValidation === 'string') {
    errors.name = RimeFormError.INVALID_FIELD;
  }

  if (Object.keys(errors).length > 0) {
    throw new RimeFormError(errors);
  }

  return true;
};
