import { cors } from '$lib/core/features/cors/index.js';
import { metas } from '$lib/core/features/metas/index.js';
import { panel } from '$lib/core/features/panel/index.js';
import { title } from '$lib/core/features/title/index.js';
import { url } from '$lib/core/features/url/index.js';
import { versions } from '$lib/core/features/versions/index.js';
import type { BuiltArea } from '$lib/core/config/types.js';
import { definePrototype } from '../define.js';
import { augmentAreaLabel } from './augment-label.js';
import type { AreaWithoutSlug } from './types.js';

/**
 * An area is a prototype with the singleton flag on: exactly one document, so create and delete
 * are off, and reads and updates need no id to say which one they mean.
 *
 * The client half of the pair — what an area *is*. `api`, `rest` and `boot` are server-only and
 * live in `definition.server.ts`.
 */
export const area = definePrototype({
  /** The name it is exported under, and the `type` every area config carries. */
  name: 'area',

  singleton: true,

  /** Authored under `areas` in a config. */
  configKey: 'areas',

  /** A document with no title field is named by its id. */
  titleFallback: 'id',

  /** One own augment: an area falls back to its capitalised slug for a label. */
  augments: [augmentAreaLabel],

  /**
   * In augment order, which is column order. No `auth`, `upload`, `nested` or `thumbnail`: an
   * area is one document, so there is nothing to sign in as, nothing listing it, and nothing for
   * it to be nested in — so it simply does not list them.
   */
  features: [panel, versions, url, title, metas, cors],

  /** A config always has an `areas` list, empty if the user named none. See collection's. */
  configure: <T extends { areas?: BuiltArea[] }>(config: T) => ({
    ...config,
    areas: config.areas || []
  })
});

/**
 * The public authoring API: `Area.create('settings', {…})`. See the collection's for why the
 * signature is stated here rather than on the definition.
 */
export const create = <S extends string>(slug: S, config: AreaWithoutSlug<S>): BuiltArea =>
  // See the collection's for the cast.
  area.create(slug, config) as BuiltArea;

declare module '$lib/core/prototype/register.js' {
  interface PrototypeConfigure<T> {
    area: T & { areas: BuiltArea[] };
  }
}
