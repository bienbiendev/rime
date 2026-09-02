import { populateURL } from './hooks/populate-url.server.js';

/**
 * The url feature's server half.
 *
 * `$rime/modules` resolves this file on a server build and stubs its export names to `undefined`
 * on a client one (see `exportFrom` in core/dev/vite.server.ts), which is what lets
 * `features/url/index.ts` be a single isomorphic definition instead of a client file and a server
 * file that have to be kept in step.
 *
 * There is no `module.ts` beside it: the augment is isomorphic and imported directly, and a hook
 * that reads private env and writes through the adapter has no client half to author.
 *
 * The export name is `urlHooks`, not `hooks`: every `module(.server).ts` export name has to be
 * unique across the whole package, since they all land in one virtual barrel.
 */
export const urlHooks = {
  beforeRead: [populateURL]
};
