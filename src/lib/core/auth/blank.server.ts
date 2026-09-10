import type { Dic } from '$lib/util/types.js';
import { PRIVATE_FIELDS } from './constant.server.js';

/**
 * A password and its better-auth link are not the document's to hand out.
 * Clean up a given document private fields.
 */
export const blankAuthDocument = (doc: Dic): Dic => {
  const clean = { ...doc };
  for (const key of PRIVATE_FIELDS) {
    delete clean[key];
  }
  return clean;
};
