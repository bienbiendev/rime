import { auth } from '$lib/core/features/auth/index.js';
import { cors } from '$lib/core/features/cors/index.js';
import { metas } from '$lib/core/features/metas/index.js';
import { nested } from '$lib/core/features/nested/index.js';
import { panel } from '$lib/core/features/panel/index.js';
import { thumbnail } from '$lib/core/features/thumbnail/index.js';
import { title } from '$lib/core/features/title/index.js';
import { upload } from '$lib/core/features/upload/index.js';
import { url } from '$lib/core/features/url/index.js';
import { versions } from '$lib/core/features/versions/index.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { definePrototype } from '../define.js';
import { augmentLabel } from './augment-label.js';
import { augmentPanel } from './augment-panel.js';
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

  /** Authored under `collections` in a config. */
  configKey: 'collections',

  /** A document with no title field is named by its id. */
  titleFallback: 'id',

  /**
   * The collection's own augments, ahead of every feature's.
   *
   * `auth` is not called here: it is a feature, and it is *first* in the list below, which is what
   * `title` needs — `title` resolves `asTitle` from the fallback `auth` and `upload` each offer,
   * so auth has to have run before it. Calling it here as well appended its fields twice and boot
   * rejected the config with "Duplicate field 'name' in collection 'staff'".
   */
  augments: [augmentLabel, augmentPanel],

  /**
   * In augment order, which is column order — `auth` first because its `removePrivateFields` and
   * its own fields precede everything, `metas` last because the doc says metas close the table.
   * The prototype owns its table, so the prototype says what may add to it and where; no feature
   * declares `extends: ['collection']` about somebody else's.
   *
   * Declared inline rather than beside the definition as an `as const` tuple. The tuple existed
   * so `applyAugments` could fold the feature names into the factory's return type; `create`
   * declares its return type instead (rule 1), so there is nothing left for a second export to
   * carry and the order is stated exactly once.
   */
  features: [auth, panel, upload, nested, versions, url, title, thumbnail, metas, cors],

  /**
   * A config always has a `collections` list, empty if the user named none.
   *
   * One line, but it belongs here rather than in the config factory: every step downstream reads
   * `config.collections` without guarding, and what makes that sound is a statement about what a
   * collection is — not something core should be defaulting on the kind's behalf.
   */
  configure: <T extends { collections?: BuiltCollection[] }>(config: T) => ({
    ...config,
    collections: config.collections || []
  })
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
 * and not `definition.server.ts` — see the rule in docs/restructure-handoff.md.
 */
export const create = <S extends string>(
  slug: S,
  config: CollectionWithoutSlug<S>
): BuiltCollection =>
  // The same erasure the registry casts through: a definition's `create` is typed by the kind the
  // definition is, and the client half is written against `BuiltPrototype` so that the registry
  // can hold both in one list.
  collection.create(slug, config) as BuiltCollection;

declare module '$lib/core/prototype/register.js' {
  interface PrototypeConfigure<T> {
    collection: T & { collections: BuiltCollection[] };
  }
}
