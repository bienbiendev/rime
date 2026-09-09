import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { PRIVATE_FIELDS } from '$lib/core/auth/constant.server.js';

export const removePrivateFields = Hooks.beforeRead({
  name: 'removePrivateFields',
  feature: 'auth',
  run: async (args) => {
    for (const key of PRIVATE_FIELDS) {
      delete args.doc[key];
    }
    return args;
  }
});
