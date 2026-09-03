import { Hooks } from '$lib/core/factory/hooks.js';
import { PRIVATE_FIELDS } from '../constant.server.js';

export const removePrivateFields = Hooks.beforeRead({
  name: 'removePrivateFields',
  requires: [],
  provides: ['sanitized'],
  run: async (args) => {
    for (const key of PRIVATE_FIELDS) {
      delete args.doc[key];
    }
    return args;
  }
});
