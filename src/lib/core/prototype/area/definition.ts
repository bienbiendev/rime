import { cors } from '$lib/core/features/cors/index.js';
import { metas } from '$lib/core/features/metas/index.js';
import { panel } from '$lib/core/features/panel/index.js';
import { title } from '$lib/core/features/title/index.js';
import { url } from '$lib/core/features/url/index.js';
import { versions } from '$lib/core/features/versions/index.js';
import type { BuiltArea } from '$lib/core/config/types.js';
import { definePrototype } from '../define.js';

/**
 * An area is a prototype with the singleton flag on: exactly one document, so create and delete
 * are off, and reads and updates need no id to say which one they mean.
 *
 * The client half of the pair — what an area *is*. `api`, `rest` and `boot` are server-only and
 * live in `module.server.ts`.
 */
export const areaFeatures = [panel, versions, url, title, metas, cors] as const;

export const area = definePrototype({
  singleton: true,

  /** A document with no title field is named by its id. */
  titleFallback: 'id',

  /**
   * In augment order, which is column order. No `auth`, `upload`, `nested` or `thumbnail`: an
   * area is one document, so there is nothing to sign in as, nothing listing it, and nothing for
   * it to be nested in — so it simply does not list them.
   */
  features: [...areaFeatures],

  /** A config always has an `areas` list, empty if the user named none. See collection's. */
  configure: <T extends { areas?: BuiltArea[] }>(config: T) => ({
    ...config,
    areas: config.areas || []
  })
});

declare module '$lib/core/prototype/register.js' {
  interface PrototypeConfigure<T> {
    area: T & { areas: BuiltArea[] };
  }
}
