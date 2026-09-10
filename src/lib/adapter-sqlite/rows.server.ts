import type { VersionsTable } from '$lib/core/adapter.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';

/**
 * What a handle builder is handed: the connection, the generated tables, and which config it is
 * building a handle for.
 *
 * `read` carries `configCtx` because `findMany` resolves a query against the config's fields;
 * `write` does not need it. `self` is the prototype's identity, which every call underneath
 * re-stated before this existed.
 */
export type HandleDeps = {
  db: any;
  tables: Dic;
  configCtx: ConfigContext;
  config: BuiltArea | BuiltCollection;
  versions?: VersionsTable;
};

/** The three bundles every verb in a handle passes down. */
export const bundles = ({ db, tables, configCtx, config, versions }: HandleDeps) => ({
  write: { db, tables },
  read: { db, tables, configCtx },
  self: { slug: config.slug, config, versions }
});
