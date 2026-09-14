import type { BuiltArea } from '$lib/core/config/types.js';
import { augmentMetas } from '$rime/modules:core/prototype/shared/metas';
import { augmentTitle } from '$lib/core/prototype/shared/title/augment.js';
import { augmentUrl } from '$lib/core/prototype/shared/url/augment.js';
import { hasUrl } from '$lib/core/prototype/shared/url/enabled.js';
import { augmentVersions } from '$lib/core/prototype/shared/versions/augment.js';
import { when } from '../when.js';
import { definePrototype } from '../define.js';
import { augmentAreaLabel } from './augment-label.js';
import type { AreaWithoutSlug } from './types.js';

/**
 * An area holds exactly one document, so create and delete are off and reads and updates need no
 * id to say which one they mean.
 *
 * The adapter reads `config.type` and builds an `AreaHandle` accordingly —
 * `adapter-sqlite/area.server.ts`.
 *
 * The client half of the pair — what an area *is*. `api`, `rest` and `boot` are server-only and
 * live in `definition.server.ts`.
 */
export const area = definePrototype({
  /** The name it is exported under, and the `type` every area config carries. */
  name: 'area',

  /**
   * Everything that shapes an area config, in the order it runs — which is column order.
   *
   * Shorter than a collection's by four: no `auth`, `upload`, `nested` or `thumbnail`. An area is
   * one document, so there is nothing to sign in as, nothing listing it, and nothing to nest it
   * in — it simply does not list them. That is what the two lists say that a shared
   * implementation with a flag could not.
   */
  augments: () => [
    augmentAreaLabel,
    augmentVersions,
    when(hasUrl, augmentUrl),
    augmentTitle,
    augmentMetas
  ]
});

/**
 * The public authoring API: `Area.create('settings', {…})`. See the collection's for why the
 * signature is stated here rather than on the definition.
 */
export const create = <S extends string>(slug: S, config: AreaWithoutSlug<S>): BuiltArea =>
  // See the collection's for the cast.
  area.create(slug, config) as BuiltArea;
