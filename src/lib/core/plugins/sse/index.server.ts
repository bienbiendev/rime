import { definePlugin, type Plugin } from '../index.js';
import { connect, emit } from './bus.server.js';
import type { SSEAccess } from './types.js';

/**
 * The event stream, at `/api/sse`.
 *
 * Send with `rime.sse.emit(key, event, payload)`, listen with `openSse(keys, handler)`.
 *
 * `rime:` keys are the panel's and need staff; every other key is refused until `access` says
 * otherwise, so an app opens its own deliberately rather than by leaving a default alone.
 *
 * @example
 * sse({ access: (key) => key.startsWith('public:') })
 */
export const sse = definePlugin(
  (options?: { access?: SSEAccess }) =>
    ({
      name: 'sse',
      actions: { emit },
      routes: { '/api/sse': { GET: connect(options?.access ?? (() => false)) } }
    }) as const satisfies Plugin
);

export type SSEActions = { emit: typeof emit };
