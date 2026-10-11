import type { BuiltCollection } from '#lib/core/config/types.js';
import { augmentAuth } from '$rime/modules:core/auth';
import { isAuth } from '#lib/core/auth/enabled.js';
import { augmentMetas } from '$rime/modules:core/prototype/shared/metas';
import { augmentNested } from '$rime/modules:core/prototype/collection/nested';
import { isNested } from '#lib/core/prototype/collection/nested/enabled.js';
import { augmentThumbnail } from '#lib/core/prototype/collection/thumbnail/augment.js';
import { augmentTitle } from '#lib/core/prototype/shared/title/augment.js';
import { augmentUpload } from '$rime/modules:core/prototype/collection/upload';
import { isUpload } from '#lib/core/prototype/collection/upload/enabled.js';
import { augmentVersions } from '#lib/core/prototype/shared/versions/augment.js';
import { when } from '../when.js';
import { definePrototype } from '../define.js';
import { augmentLabel } from './augment-label.js';
import type { CollectionWithoutSlug } from './types.js';

/**
 * A collection: many documents, addressed by id, with the full set of operations.
 *
 * The client half of the pair: what a collection *is*. `definition.server.ts` spreads it and adds
 * `rest` and `hooks`.
 *
 * The augments live here because `create` runs them on both sides, so a client build has to reach
 * them.
 */
export const collection = definePrototype({
  /** The name it is exported under, and the `type` every collection config carries. */
  name: 'collection',
  /**
   * **Everything that shapes a collection config, in the order it runs** — which is the order the
   * fields land in, and therefore column order. A step that does not always apply has its guard
   * beside it.
   *
   * `auth` and `upload` run before `title`, which resolves `asTitle` from the fallback each offers.
   * `metas` is last because metas close the table.
   * `augmentVersions` runs on every config and checks `versions` itself.
   *
   * `panel` and `cors` are not here: they shape the whole config, in `configureConfig`
   * (`config/configure.ts`).
   */
  augments: () => [
    augmentLabel,
    when(isAuth, augmentAuth),
    when(isUpload, augmentUpload),
    when(isNested, augmentNested),
    augmentVersions,
    augmentTitle,
    augmentThumbnail,
    augmentMetas
  ]
});

/**
 * The public authoring API: `Collection.create('pages', {…})`.
 *
 * One line over `collection.create`, and it exists for the one thing a definition prop cannot
 * state: the authoring type is generic in the slug — `Collection<S>` types `$hooks` and `$url`
 * from it — and no type parameter can carry a generic type. So the composition lives in
 * `definePrototype` and the signature lives here, next to the kind it belongs to.
 *
 * Isomorphic on purpose. A feature that derives a collection (`auth`'s `staff`) imports this file,
 * never `definition.server.ts`, which spreads `{ ...base }` at module scope.
 */
export const create = <S extends string>(
  slug: S,
  config: CollectionWithoutSlug<S>
): BuiltCollection =>
  // A definition's `create` is typed against `BuiltPrototype`; the cast narrows it to a collection.
  collection.create(slug, config) as BuiltCollection;
