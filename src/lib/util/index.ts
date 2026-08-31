import { env } from '$env/dynamic/public';
import * as upload from '../core/features/upload/util/client.js';
import { access } from './access/index.js';
import * as array from './array.js';
// `doc` was one file; its halves now live where the placement rule puts them — the document
// builders in core/prototype/, the pure path helpers here. This barrel is public API
// (`rimecms/util`), so the namespace it publishes keeps its original shape.
import * as docBuilders from '$lib/core/prototype/doc.js';
import * as docPath from './path.js';

const doc = { ...docBuilders, ...docPath };
import * as file from './file.js';
import * as object from './object.js';
import * as random from './random.js';
import * as state from './state.js';
import * as string from './string.js';
import * as validate from './validate.js';

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
