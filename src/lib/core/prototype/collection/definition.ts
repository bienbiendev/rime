import type { BuiltCollection } from '$lib/core/config/types.js';
import { augmentAuth } from '$rime/modules';
import { isAuth } from '$lib/core/auth/enabled.js';
import { augmentMetas } from '$lib/core/metas/augment.js';
import { augmentNested } from '$rime/modules';
import { isNested } from '$lib/core/prototype/collection/nested/enabled.js';
import { augmentThumbnail } from '$lib/core/prototype/collection/thumbnail/augment.js';
import { augmentTitle } from '$lib/core/prototype/shared/title/augment.js';
import { augmentUpload } from '$rime/modules';
import { isUpload } from '$lib/core/prototype/collection/upload/enabled.js';
import { augmentUrl } from '$lib/core/prototype/shared/url/augment.js';
import { hasUrl } from '$lib/core/prototype/shared/url/enabled.js';
import { augmentVersions } from '$lib/core/versions/augment.js';
import { when } from '../when.js';
import { definePrototype } from '../define.js';
import { augmentLabel } from './augment-label.js';
import type { CollectionWithoutSlug } from './types.js';

/**
 * A collection: many documents, addressed by id, with the full set of operations.
 *
 * The client half of the pair. It carries everything a client build needs — what a collection
 * *is* — and none of what only a server can do: `api` and `rest` are declared in
 * `definition.server.ts`, which re-exports this with those added.
 *
 * That split is what lets the definition hold `features` and `augments`: `create` runs them on
 * both sides, so both lists have to be reachable from a client build, which a `.server.ts`
 * definition never was.
 */
export const collection = definePrototype({
  /** The name it is exported under, and the `type` every collection config carries. */
  name: 'collection',
  singleton: false,
  /**
   * **Everything that shapes a collection config, in the order it runs** — which is the order the
   * fields land in, and therefore column order (CONTRIBUTING rule 2).
   *
   * This was two declarations: `augments: [augmentLabel]` for the prototype's own, and
   * `features: [auth, panel, upload, …]` for the rest, folded by `applyAugments`, each entry
   * gated by a `FeatureDefinition.enabled` predicate declared in its own file. Reading the chain
   * meant opening ten of them. It is one list now, and the guard is beside the step.
   *
   * `auth` is first because `title` resolves `asTitle` from the fallback `auth` and `upload` each
   * offer, so both have to have run before it. `metas` is last because metas close the table.
   * `augmentVersions` carries its own guard on its first line; the four `when`s are the rest of
   * what `enabled` used to answer, and the unguarded steps are the six that answered `() => true`.
   *
   * `panel` and `cors` are not here: neither has an augment. They shape the whole config and are
   * called by the config chain — see `config/build.ts`.
   */
  augments: () => [
    augmentLabel,
    when(isAuth, augmentAuth),
    when(isUpload, augmentUpload),
    when(isNested, augmentNested),
    augmentVersions,
    when(hasUrl, augmentUrl),
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
 * Isomorphic on purpose. A feature that derives a collection (`auth`'s `staff`) imports this file
 * and not `definition.server.ts` — see rule 3 in CONTRIBUTING.md.
 */
export const create = <S extends string>(
  slug: S,
  config: CollectionWithoutSlug<S>
): BuiltCollection =>
  // The same erasure the registry casts through: a definition's `create` is typed by the kind the
  // definition is, and the client half is written against `BuiltPrototype` so that the registry
  // can hold both in one list.
  collection.create(slug, config) as BuiltCollection;
