import { cache } from '../cache/index.js';
import type { Plugin } from '../index.js';
import type { PluginHost } from './types.js';

/**
 * The plugins rime adds to every config, client half.
 *
 * `cache` is the only one of the four with a client side — it contributes the panel's clear-cache
 * button — so it is the only one here. `sse`, `apiInit` and `mailer` are server-only, and a
 * client build importing them resolves to `undefined` rather than to nothing (see
 * docs/rime-modules-resolution.md, case C), which is why the list is a pair rather than one
 * isomorphic array with a `dev`/`$smtp` filter.
 */
// The config is what the server half branches on ($cache, $smtp); this side has nothing to read
// off it, and takes it anyway so both halves are the same function.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultPlugins = (config: PluginHost): Plugin[] => [cache()];
