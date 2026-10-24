import type { AdapterDeps } from '#lib/adapter-sqlite/types.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { baseTableName, junctionKey, tableName } from './naming.server.js';
import type { BeforeOperationRelation, RelationRow } from '#lib/fields/relation/index.js';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import { isWithin } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import { and, eq, getTableColumns, inArray, isNull, or, type SQLWrapper } from 'drizzle-orm';
import { transformDataToSchema } from './columns.server.js';
import { resolveRelationTarget } from './transform.server.js';

/**
 * The junction rows of a prototype's relation fields, in its `__$relations` table: one row per
 * related document, at the field's `path`, in `position` order, the target in a column of its
 * own (`mediasId`).
 */
const createRelationsHandle = ({ db, tables }: AdapterDeps) => {
  /**
   * Deletes the junction rows at or below each of `paths`: `sections.1` takes `sections.1.image`,
   * not `sections.10.image`. With `locale`, on a junction that has a `locale` column, only rows of
   * that locale go; unlocalized rows stay.
   */
  const deleteFromPaths: DeleteFromPaths = async ({ parentSlug, ownerId, paths, locale }) => {
    if (paths.length === 0) return true;

    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];
    if (!table) return true;

    // Only a junction holding a localized relation has a `locale` column (getAll checks the same).
    // Unlike getAll, this keeps the rows of `locale` only, not the unlocalized ones.
    const columns = Object.keys(getTableColumns(table));
    const conditions: SQLWrapper[] = [eq(table.ownerId, ownerId)];
    if (locale && columns.includes('locale')) {
      conditions.push(eq(table.locale, locale));
    }
    const existingRelations = await db
      .select({ id: table.id, path: table.path })
      .from(table)
      .where(and(...conditions));

    const toDelete = existingRelations
      .filter((row) => paths.some((path) => isWithin(row.path, path)))
      .map((row) => row.id);

    if (!toDelete.length) return true;

    await db.delete(table).where(inArray(table.id, toDelete));

    return true;
  };

  /**
   * Inserts one junction row per relation that names a document, in order; one with no
   * `documentId` is skipped. The first insert that fails throws, naming its path, and the rows
   * before it stay written.
   */
  const create: Create = async ({ parentSlug, ownerId, relations }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];
    const columns = getTableColumns(table);

    for (const relation of relations) {
      if (!relation.documentId) continue;

      const relationToIdKey = junctionKey(relation.relationTo);
      const baseValues: Dic = {
        path: relation.path,
        position: relation.position,
        [relationToIdKey]: relation.documentId,
        ownerId
      };

      if (relation.locale) {
        baseValues.locale = relation.locale;
      }

      const values = transformDataToSchema(baseValues, columns);

      try {
        await db.insert(table).values(values);
      } catch (err: any) {
        throw writeError('create', relation.path, err);
      }
    }
    return true;
  };

  /**
   * Writes each row's `path`, `position` and target, by its id. On a junction with a `locale`
   * column, its `locale` too.
   */
  const update: Update = async ({ parentSlug, relations }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];
    const columns = getTableColumns(table);

    try {
      await Promise.all(
        relations.map((relation) => {
          const values = transformDataToSchema(
            {
              path: relation.path,
              position: relation.position,
              [junctionKey(relation.relationTo)]: relation.documentId,
              // Written where the junction has a `locale` column
              ...('locale' in columns && { locale: relation.locale })
            },
            columns
          );
          return db.update(table).set(values).where(eq(table.id, relation.id));
        })
      );
    } catch (err: any) {
      throw writeError('update', relations[0]?.path, err);
    }

    return true;
  };

  /** Deletes the junction rows named by id. */
  const deleteRelations: Delete = async ({ parentSlug, relations }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];

    if (relations.length === 0) return true;

    const documentIds = relations
      .map((rel) => rel.id)
      .filter((id): id is string => id !== undefined);
    if (documentIds.length === 0) return true;

    try {
      await db.delete(table).where(inArray(table.id, documentIds));
    } catch (err: any) {
      throw writeError('delete', relations[0]?.path, err);
    }

    return true;
  };

  /**
   * Every junction row of `ownerId`, read as `relationTo` and `documentId`. With `locale`, the rows
   * of that locale and the unlocalized ones.
   */
  const getAll: GetAllRelations = async ({ parentSlug, ownerId, locale }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });

    // No relation field, no junction table: no rows.
    if (!(relationTableName in tables)) {
      return [];
    }

    const table = tables[relationTableName];
    const columns = Object.keys(getTableColumns(table));

    let conditions;
    if (locale && columns.includes('locale')) {
      conditions = [eq(table.ownerId, ownerId), or(eq(table.locale, locale), isNull(table.locale))];
    } else {
      conditions = [eq(table.ownerId, ownerId)];
    }

    const rows = await db
      .select()
      .from(table)
      .where(and(...conditions));

    // Core reads `relationTo` and `documentId`, never the per-target column
    return rows.map((row) => resolveRelationTarget({ ...row }) as RelationRow);
  };

  // One query per target, against the table the junction rows' foreign key points at.
  const missing: Missing = async ({ relationTo, ids }) => {
    if (!ids.length) return [];
    const table = tables[baseTableName(relationTo)];
    if (!table) return ids;

    const found = await db.select({ id: table.id }).from(table).where(inArray(table.id, ids));
    const existing = new Set(found.map((row: { id: string }) => row.id));
    return ids.filter((id) => !existing.has(id));
  };

  return {
    create,
    update,
    delete: deleteRelations,
    deleteFromPaths,
    getAll,
    missing
  };
};

export default createRelationsHandle;

/**
 * A relation write that failed, as an error that fails the save.
 */
const writeError = (operation: string, path: string | undefined, err: Error) =>
  new RimeError(
    RimeError.OPERATION_ERROR,
    `relations ${operation} failed${path ? ` at ${path}` : ''}: ${err.message}`
  );

type Missing = (args: { relationTo: PrototypeSlug; ids: string[] }) => Promise<string[]>;

type DeleteFromPaths = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  paths: string[];
  locale?: string;
}) => Promise<boolean>;

type Delete = (args: { parentSlug: PrototypeSlug; relations: RelationRow[] }) => Promise<boolean>;
type Update = (args: { parentSlug: PrototypeSlug; relations: RelationRow[] }) => Promise<boolean>;
type Create = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  relations: BeforeOperationRelation[];
}) => Promise<boolean>;

type GetAllRelations = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  locale?: string;
}) => Promise<RelationRow[]>;
