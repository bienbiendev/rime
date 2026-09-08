import type { Dic } from '$lib/util/types.js';
import { PRIVATE_FIELDS } from './private-fields.js';

/**
 * A password and its better-auth link are not the document's to hand out.
 *
 * `prototype/api.server.ts` used to do this inline, behind an `isAuthConfig` test, with a comment
 * saying it belonged on the feature "once features land" — so here it is. Only the API's `blank()`
 * runs it: `merge-with-blank` builds its own blank to seed a write, and that one still needs the
 * private members so a create nulls them out.
 *
 * A deletion rather than a filter over `config.fields`, which is what the inline version did: that
 * kept only `FormFieldBuilder`s, and tabs and groups are neither — so a blank auth document came
 * back missing them. The `staff` collection has none, so nothing showed it.
 */
export const blankAuthDocument = (doc: Dic): Dic => {
  const clean = { ...doc };
  for (const key of PRIVATE_FIELDS) {
    delete clean[key];
  }
  return clean;
};
