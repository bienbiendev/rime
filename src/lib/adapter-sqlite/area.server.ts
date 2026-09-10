import type { AreaHandle } from '$lib/core/adapter.js';
import type { BuiltArea } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RawDoc } from '$lib/core/prototype/types.js';
import { baseTableName } from './naming.server.js';
import { bundles, type HandleDeps } from './rows.server.js';
import { findManyPrototypes, readPrototype } from './read.server.js';
import { ensurePrototypeExists, updatePrototype, updateWherePrototype } from './write.server.js';

/**
 * What the adapter can do to one registered area.
 *
 * Exactly one document, so no verb here takes an id — `resolveRowId` below is where the one they
 * need comes from, and it is the *only* place the difference between the two kinds shows. There is
 * no `insert` and no `delete`: not refused, absent.
 *
 * The collection's builder is `collection.server.ts` beside this.
 */
export const createAreaHandle = (deps: HandleDeps): AreaHandle => {
  const { write, read, self } = bundles(deps);
  const { slug } = self;

  /**
   * The one row, looked up.
   *
   * An area's row is written at boot by `ensureExists`, so a missing one is a boot that did not
   * run rather than a request that asked for the wrong thing — which is what the message says.
   */
  const resolveRowId = async () => {
    const table = deps.tables[baseTableName(slug)];
    const [row] = await deps.db.select({ id: table.id }).from(table);

    if (!row) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        `${slug} has no row; its boot step should have written one`
      );
    }

    return row.id as string;
  };

  return {
    slug,
    config: deps.config as BuiltArea,
    versions: deps.versions,

    find: (args = {}) =>
      readPrototype(read, { ...args, ...self, id: undefined }) as Promise<RawDoc | undefined>,

    findMany: (args = {}) => findManyPrototypes(read, { ...args, ...self }),

    update: async (args) =>
      updatePrototype(write, { ...args, slug, versions: deps.versions, id: await resolveRowId() }),

    updateWhere: (args) => updateWherePrototype(read, { ...args, slug }),

    ensureExists: (args) => ensurePrototypeExists(write, { ...args, slug, versions: deps.versions })
  };
};
