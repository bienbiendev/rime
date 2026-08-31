import { defineFeature } from '../index.js';
import { augmentVersions } from './augment.js';
import { makeVersionsCollectionsAliases } from './derive.server.js';
import { versionsRuntime } from './runtime.server.js';

/**
 * The `versions` feature: keep every revision of a document, optionally with a draft status.
 *
 * The third feature under the contract, and the one that shows its limits. `url` and `upload`
 * fit the shape cleanly because the adapter never needs to know they exist (docs §14.4). This
 * one does not, and the object below is honest about how much of the feature it fails to cover:
 *
 * - **augment** and **derive** are declared here, and both work exactly like upload's.
 * - **hooks** are two, in runtime.server.ts.
 * - **storage is missing entirely.** Versions is the only feature that changes the *topology* of
 *   a prototype's tables rather than adding fields or deriving a sibling — root table split from
 *   a `<slug>_versions` shadow, with every locales, blocks, tree and Rels table re-parented onto
 *   the shadow. `generateSchemaString` branches on `collection.versions` directly to do that,
 *   and seven more adapter files import this feature's `naming.ts` and `strategy.ts` to build
 *   queries against the result.
 *
 * That last point is not something a `storage` seam on this object could express today, because
 * `Adapter` is `ReturnType<typeof createCollectionFacade>` — a type derived *from* the SQLite
 * implementation rather than an interface it implements. There is nothing to declare a
 * capability against. Making `Adapter` a real interface is the prerequisite, and it is a
 * separate piece of work from this one (docs §14.6, §19).
 *
 * Note also `derive` here does something upload's does not: it marks the derived prototype
 * `_generateSchema: false` / `_generateTypes: false`, because the adapter generates those tables
 * itself. Those two flags *are* the seam between "a feature derives storage" and "the adapter
 * owns storage" — unnamed, and the thing a capability contract would replace.
 */
export const versions = defineFeature({
  ...versionsRuntime,

  // One function for both sides: the status field is part of the client config too.
  augment: { client: augmentVersions, server: augmentVersions },

  // Server only — the aliases exist so operations can address `pages_versions` through the
  // normal collection API, which is a server concern.
  derive: { server: makeVersionsCollectionsAliases }
});
