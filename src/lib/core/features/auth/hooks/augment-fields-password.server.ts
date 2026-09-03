import { Hooks } from '$lib/core/pipeline/hooks.js';
import { usersFields } from '../fields.js';

/**
 * Appends the `password` field to the config, so the validation steps that follow
 * (buildDataConfigMap → validateFields) see it and enforce the password policy.
 *
 * `password` is not a column — better-auth stores the credential. It lives in the config
 * purely to carry `validate.password`, which is why it is added here per-operation rather
 * than declared on the collection in augment.ts.
 *
 * Must run *after* mergeWithBlankDocument. The blank document is built from `config.fields`,
 * and the config map is built from the *data*: augment before the merge and every create
 * gains a blank `password`, which then fails its own `.required()` check on the paths that
 * legitimately have no password — better-auth's post-signup callback, which creates the
 * document with `{ name, email, authUserId }`.
 *
 * `confirmPassword` deliberately does NOT appear here. It is a form control, not data: the
 * only thing a server-side comparison proves is that the same client sent the same value
 * twice. The panel enforces the match in AuthFooter.svelte, where a mistyped password can
 * still be corrected.
 */
export const augmentFieldsPassword = Hooks.beforeUpsert<'auth'>({
  name: 'augmentFieldsPassword',
  requires: ['blank-merged'],
  provides: ['config-fields'],
  run: async (args) => {
    let { config } = args;

    const IS_PASSWORD_AUTH =
      config.auth && typeof config.auth !== 'boolean' && config.auth.type === 'password';

    if (IS_PASSWORD_AUTH) {
      config = {
        ...config,
        fields: [...config.fields, usersFields.password]
      };
    }

    return {
      ...args,
      config
    };
  }
});
