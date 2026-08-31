import { env } from '$env/dynamic/public';
import { access } from '$lib/core/features/auth/access.js';
import * as validate from '$lib/core/fields/validate.js';
import * as docBuilders from '$lib/core/prototype/doc.js';
import * as upload from '$lib/core/features/upload/util/client.js';
import * as array from './array.js';
import * as docPath from './path.js';
import * as file from './file.js';
import * as object from './object.js';
import * as random from './random.js';
import * as state from './state.js';
import * as string from './string.js';

/**
 * The public `rimecms/util` surface, for config authors.
 *
 * This is a **barrel, not a home**: what a namespace here re-exports and where that code lives
 * are separate questions. Everything in `./*` passes the util rule (no rime vocabulary), while
 * `access`, `validate` and half of `doc` name rime types and therefore live with their concept
 * — auth, fields and prototype respectively. They are published from here because config
 * authors have always imported them from here, and that path is not worth breaking.
 */

/** `doc` used to be one file; its halves now live where the rule puts them. */
const doc = { ...docBuilders, ...docPath };

/**
 * Build the api full url for given segments
 * @example
 * apiUrl('some-collection') // -> http://localhost:5713/api/some-collection
 * apiUrl('some-collection', '12345') // -> http://localhost:5713/api/some-collection/12345
 */
export function apiUrl(...args: string[]) {
  return `${env.PUBLIC_RIME_URL}/api/${args.join('/')}`;
}

export { access, array, doc, file, object, random, state, string, upload, validate };
