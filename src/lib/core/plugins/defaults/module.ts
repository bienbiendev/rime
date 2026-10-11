import { cache } from '../cache/index.js';
import type { Plugin } from '../index.js';
import type { PluginHost } from './types.js';

/**
 * The plugins rime adds to every config, client half.
 *
 * `cache` is the only one with a client side — it contributes the panel's clear-cache button — so
 * it is the only one here. `sse`, `apiInit` and `mailer` are server-only `.server.ts` files that
 * this half cannot import, which is why this is a pair rather than one isomorphic array with a
 * `dev`/`$smtp` filter.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultPlugins = (config: PluginHost): Plugin[] => [cache()];
