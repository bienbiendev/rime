import type { BuiltCollection } from '$lib/core/config/types.js';
import { ensureMedias } from '$lib/core/prototype/collection/upload/ensure.server.js';

/**
 * Upload's boot step, in a module of its own **with no `module.ts` beside it**.
 *
 * That placement is the whole point. `features/upload/module.server.ts` has a client half, and a
 * name only the server half declares is *not exported* on a client build rather than `undefined`
 * — which fails at link time with "does not provide an export named" the moment `index.ts`, which
 * is client-reachable, imports it. Boot rejected this file's first home for exactly that reason.
 * See `core/dev/codegen/runtime/index.server.ts`.
 */
export const bootUpload = (config: { collections?: BuiltCollection[] }) => ensureMedias(config);
