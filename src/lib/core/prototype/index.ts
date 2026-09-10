/**
 * The two prototypes, isomorphic halves.
 *
 * There was a registry here — `prototypeNames`, `protos`, `prototypes`, plus folds over them. It
 * bought core the ability never to write the words `collection` and `area`, and it cost the folder
 * its entry point: three exports that were three views of the same two objects, and callers that
 * merged both lists only to split them apart again further down.
 *
 * The server halves are **not** re-exported here. They carry `api`, `rest` and `boot`, they are
 * different objects under the same two names, and a caller that needs one names
 * `collection/definition.server.js` — the path says which half, where the name could not.
 */
export { collection } from './collection/index.js';
export { area } from './area/index.js';
