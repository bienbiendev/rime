import { Hooks } from '#lib/core/pipeline/define-hook.js';
import validate from '#lib/core/fields/validate.js';
import { text } from '#lib/fields/text/index.js';

const passwordField = text('password')
  .required()
  .access({
    create: () => true,
    read: () => false,
    update: () => false
  })
  .validate((value) => validate.password(value));

/**
 * On a create, appends the `password` field to a password-auth config, so `validateFields`
 * enforces the password policy. `password` is not a column: better-auth stores the credential.
 */
export const augmentFieldsPassword = Hooks.beforeCreate<'auth'>(
  async function augmentFieldsPassword(args) {
    let { config } = args;

    const IS_PASSWORD_AUTH = config.auth?.type === 'password';

    if (IS_PASSWORD_AUTH) {
      config = {
        ...config,
        fields: [...config.fields, passwordField]
      };
    }

    return {
      ...args,
      config
    };
  }
);
