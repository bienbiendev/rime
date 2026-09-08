import type { Dic } from '$lib/util/types.js';
import { PRIVATE_FIELDS } from '../constant.server.js';

/**
 * A password and its better-auth link are not the document's to hand out.
 *
 * A module with **no client half**, so `$rime/modules` stubs the name to `undefined` on a client
 * build — and `PRIVATE_FIELDS` itself never crosses. That is the point of the indirection: the
 * list stays in `constant.server.ts` with one definition, and what the isomorphic
 * `features/auth/index.ts` imports is this function, not the constant. Nothing calls it on the
 * client anyway: `blank()` is assembled in `prototype/api.server.ts`.
 *
 * A deletion rather than a filter over `config.fields`, which is what the inline version in
 * `api.server.ts` did: that kept only `FormFieldBuilder`s, and tabs and groups are neither — so a
 * blank auth document came back missing them.
 *
 * Measured, the only member this removes today is `apiKeyId`, on an `apiKey` collection.
 * `password` is not a config field at all — `hooks/augment-fields-password.server.ts` appends it
 * at write time — so it never reaches a blank document, on either side.
 */
export const blankAuthDocument = (doc: Dic): Dic => {
  const clean = { ...doc };
  for (const key of PRIVATE_FIELDS) {
    delete clean[key];
  }
  return clean;
};
