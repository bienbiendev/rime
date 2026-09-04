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

/**
 * A collection: many documents, addressed by id, with the full set of operations.
 *
 * The client half of the pair. It carries everything a client build needs — what a collection
 * *is* — and none of what only a server can do: `api` and `rest` are declared in
 * `module.server.ts`, which re-exports this with those added. `$rime/modules` picks the side, so
 * `index.ts` is one isomorphic file either way.
 *
 * That split is what lets the definition hold `features`: the config factory runs their augments
 * on both sides, so the list has to be reachable from a client build, which a `.server.ts`
 * definition never was.
 */
export const collectionFeatures = [
  auth,
  panel,
  upload,
  nested,
  versions,
  url,
  title,
  thumbnail,
  metas,
  cors
] as const;

export const collection = definePrototype({
  singleton: false,

  /** A document with no title field is named by its id. */
  titleFallback: 'id',

  /**
   * In augment order, which is column order — `auth` first because its `removePrivateFields` and
   * its own fields precede everything, `metas` last because the doc says metas close the table.
   * The prototype owns its table, so the prototype says what may add to it and where; no feature
   * declares `extends: ['collection']` about somebody else's.
   */
  features: [...collectionFeatures],

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

declare module '$lib/core/prototype/register.js' {
  interface PrototypeConfigure<T> {
    collection: T & { collections: BuiltCollection[] };
  }
}
