import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { PRIVATE_FIELDS } from '$lib/core/auth/constant.server.js';

/**
 * Strips auth's private members from a document on its way out — the password, the better-auth
 * link.
 *
 * First in `beforeRead`, so nothing deriving from the document can copy one into derived data.
 */
export const removePrivateFields = Hooks.beforeRead(async function removePrivateFields(args) {
  for (const key of PRIVATE_FIELDS) {
    delete args.doc[key];
  }
  return args;
});
