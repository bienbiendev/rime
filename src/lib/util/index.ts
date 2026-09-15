import { access } from '$lib/core/auth/access.js';
import * as validate from '$lib/core/fields/validate.js';
import * as upload from '$lib/core/prototype/collection/upload/util/client.js';
import * as array from './array.js';
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
 * `access` and `validate` name rime types and therefore live with their concept — auth and fields
 * respectively. They are published from here because that is the path config authors import them
 * from.
 *
 * Nothing inside the library imports from here: internal code reaches for the module itself, so
 * this barrel stays a leaf of the import graph.
 */

export { access, array, file, object, random, state, string, upload, validate };
