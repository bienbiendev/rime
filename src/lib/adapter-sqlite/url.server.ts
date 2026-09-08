import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger.server.js';
import type { GetRegisterType } from '$lib/index.js';
import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { GenericTables } from './types.server.js';
import { baseTableName, tableName } from './naming.server.js';

type Params = {
  /** The document. */
  id: string;
  /** The row its content is on, when that is not the base row. */
  contentId?: string;
  slug: string;
  /** Where this prototype's content lives, when it is not its own row. */
  shadowSlug?: string;
  locale?: string;
  db: LibSQLDatabase<GetRegisterType<'Schema'>>;
  tables: GenericTables;
};

/**
 * Writes a document's computed `url` onto the row that holds it.
 *
 * Four cases until this commit, decoded from `locale` and `config.versions` through an
 * `OPERATION` enum — root, locale, version, version+locale — each rebuilding the versions
 * feature's table name for itself. They are two independent questions and always were:
 *
 * - **which table** — the prototype's own, or its shadow when a feature gave it one
 * - **which branch** — the table itself, or its `__$$locales` half when writing one locale
 *
 * So there is one lookup and one `if`. The caller says which row it means (`contentId`), the same
 * way it does for `find` and `update`; nothing here asks a config what a version is.
 */
export async function updateDocumentUrl(url: string, params: Params) {
  const { slug, shadowSlug, id, tables, db, locale } = params;

  // On a prototype with a shadow the url belongs to the content row, and only the caller knows
  // which one this document is showing.
  const contentId = shadowSlug ? params.contentId : id;

  if (!contentId) {
    logger.warn(`can't define url update operation for ${slug}, ${id}`);
    return;
  }

  const contentTable = baseTableName(shadowSlug ?? slug);

  // The locales branch is addressed by its owner, the table itself by its own id. The `ownerId`
  // half of the shadow case is redundant on a unique id and was in the original: it keeps a
  // `contentId` belonging to another document from writing the wrong row.
  const localesTable = tableName({ owner: contentTable, branch: 'locales' }) as keyof GenericTables;
  const table = locale ? tables[localesTable] : tables[contentTable];
  const where = locale
    ? and(eq(table.ownerId, contentId), eq(table.locale, locale))
    : shadowSlug
      ? and(eq(table.ownerId, id), eq(table.id, contentId))
      : eq(table.id, id);

  const operation = db.update(table).set({ url }).where(where);

  try {
    operation.run();
  } catch (err: any) {
    throw new RimeError(
      RimeError.OPERATION_ERROR,
      `Error storing url for ${slug}, ${id}. ${err.message}`
    );
  }
}
