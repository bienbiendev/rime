import { dev } from '$app/environment';
import { apiInit } from '../api-init/index.js';
import { cache } from '../cache/index.js';
import type { Plugin } from '../index.js';
import { mailer } from '../mailer/index.js';
import { sse } from '../sse/index.js';
import type { PluginHost } from './types.js';

/** The plugins rime adds to every config, server half. Two of the four are conditional. */
export const defaultPlugins = (config: PluginHost): Plugin[] => [
  // Server Sent Events
  sse(),
  // Cache plugin, with default isEnabled: event => !event.locals.user
  cache(config.$cache || {}),
  // Init endpoint, dev only
  ...(dev ? [apiInit()] : []),
  ...(config.$smtp ? [mailer(config.$smtp)] : [])
];
