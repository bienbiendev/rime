import type { CacheConfig, RouteConfig } from '$lib/core/config/types.js';
import type { SMTPConfig } from '../mailer/module.server.js';
import type { Plugin } from '../index.js';

/**
 * What the plugin step reads off a config.
 *
 * Both halves of `defaultPlugins` take this rather than `Config` or `SanitizedConfigClient`: the
 * step runs on both sides, and naming either one there would pin it to a side. `$cache` and
 * `$smtp` are what the server half branches on; a client build reads neither, and still takes the
 * argument so the two halves are the same function.
 */
export type PluginHost = {
  plugins?: Plugin[];
  $routes?: Record<string, RouteConfig>;
  $cache?: CacheConfig;
  $smtp?: SMTPConfig;
};
