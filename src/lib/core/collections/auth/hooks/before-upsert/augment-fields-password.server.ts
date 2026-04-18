import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { usersFields } from '../../fields.js';

/**
 * For update/create operations,
 * add fields password and confirmPassword
 * to add validations
 */
export const augmentFieldsPassword = Hooks.beforeUpsert<'auth'>(async (args) => {
  let { config } = args;

  const IS_PASSWORD_AUTH =
    config.auth && typeof config.auth !== 'boolean' && config.auth.type === 'password';

  if (IS_PASSWORD_AUTH) {
    config = {
      ...config,
      fields: [...config.fields, usersFields.password, usersFields.confirmPassword]
    };
  }

  return {
    ...args,
    config
  };
});
