import { hasAuthUser } from '#lib/core/auth/better-auth-tables.server.js';
import { STAFF_SLUG } from '#lib/core/auth/constant.js';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { email as validateEmail, password as validatePassword } from '#lib/core/fields/validate.js';
import { extractData } from '#lib/core/pipeline/extract-data.server.js';
import type { FormErrors } from '#lib/types.js';
import { trycatch, trycatchSync } from '#lib/util/function.js';
import { dev } from '$app/env';
import { type RequestHandler } from '@sveltejs/kit';
import { definePlugin, type Plugin } from '../index.js';

export const apiInit = definePlugin(() => {
  const requestHandler: RequestHandler = async (event) => {
    if (!dev) throw new RimeError(RimeError.NOT_FOUND);

    const alreadyHasAuthUser = await hasAuthUser(event.locals.rime.adapter);
    if (alreadyHasAuthUser) {
      throw new RimeError(RimeError.NOT_FOUND);
    }

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) throw new RimeError(RimeError.INVALID_DATA, extractError.message);

    const [error] = trycatchSync(() => validateForm(data));
    if (error) throw new RimeError(RimeError.INVALID_DATA, error.message);

    event.locals.isInit = true;

    const response = await event.locals.rime.auth.api.signUpEmail({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
        type: STAFF_SLUG
      }
    });

    return Response.json({ initialized: true, user: response.user });
  };

  return {
    name: 'apiInit',
    routes: {
      '/api/init': {
        POST: requestHandler
      }
    }
  } as const satisfies Plugin;
});

export const validateForm = (
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
  if (password && typeof passwordValidation === 'string') {
    errors.password = passwordValidation;
  }

  if (Object.keys(errors).length > 0) {
    throw new RimeFormError(errors);
  }

  return true;
};
