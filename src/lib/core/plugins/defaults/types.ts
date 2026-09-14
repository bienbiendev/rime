import type { RouteConfig } from '$lib/core/config/types.js';
import type { CacheConfig } from '$lib/core/plugins/cache/types.js';
import type { SMTPConfig } from '../mailer/index.server.js';
import type { SSEConfig } from '../sse/types.js';
import type { Plugin } from '../index.js';

/**
 * What the plugin step reads off a config.
 *
 * Both halves of `defaultPlugins` take this rather than `Config` or `SanitizedConfigClient`: the
 * step runs on both sides, and naming either one there would pin it to a side. `$cache`, `$smtp`
 * and `$sse` are what the server half reads; a client build reads none of them, and still takes
 * the argument so the two halves are the same function.
 */
export type PluginHost = {
  plugins?: Plugin[];
  $routes?: Record<string, RouteConfig>;
  $cache?: CacheConfig;
  $smtp?: SMTPConfig;
  $sse?: SSEConfig;
};
