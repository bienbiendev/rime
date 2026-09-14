import { access } from '$lib/core/auth/access.js';
import * as validate from '$lib/core/fields/validate.js';
import * as upload from '$lib/core/prototype/collection/upload/util/client.js';
import * as docBuilders from '$lib/core/prototype/doc.js';
import * as array from './array.js';
import * as file from './file.js';
import * as object from './object.js';
import * as docPath from './path.js';
import * as random from './random.js';
import * as state from './state.js';
import * as string from './string.js';

/**
 * The public `rimecms/util` surface, for config authors.
 *
 * This is a **barrel, not a home**: what a namespace here re-exports and where that code lives
 * are separate questions. Everything in `./*` passes the util rule (no rime vocabulary), while
 * `access`, `validate` and half of `doc` name rime types and therefore live with their concept
 * — auth, fields and prototype respectively. They are published from here because that is the
 * path config authors import them from.
 */

/** `doc`'s two halves, each living with the concept it names. */
const doc = { ...docBuilders, ...docPath };

export { access, array, doc, file, object, random, state, string, upload, validate };
