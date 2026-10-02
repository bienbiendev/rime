import type { AdapterDeps } from '$lib/adapter-sqlite/types.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { baseTableName, tableName } from './naming.server.js';
import type { BeforeOperationRelation, RelationRow } from '$lib/fields/relation/index.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { omit } from '$lib/util/object.js';
import { isWithin } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import { and, eq, getTableColumns, inArray, isNull, or, type SQLWrapper } from 'drizzle-orm';
import { transformDataToSchema } from './columns.server.js';

const createRelationsHandle = ({ db, tables }: AdapterDeps) => {
  //
  const deleteFromPaths: DeleteFromPaths = async ({ parentSlug, ownerId, paths, locale }) => {
    if (paths.length === 0) return true;

    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];
    if (!table) return true;

    // Only some relation tables have a `locale` column at all — it's added
    // only when the collection has at least one .localized() relation field
    // (see getAll's identical guard below). Without this check, eq(undefined,
    // locale) produces SQL with a missing column reference.
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

  const create: Create = async ({ parentSlug, ownerId, relations }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });
    const table = tables[relationTableName];
    const columns = getTableColumns(table);

    for (const relation of relations) {
      if (!relation.documentId) continue;

      const relationToIdKey = `${relation.relationTo}Id`;
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
          const values = transformDataToSchema(omit(['id'], relation), columns);
          return db.update(table).set(values).where(eq(table.id, relation.id));
        })
      );
    } catch (err: any) {
      throw writeError('update', relations[0]?.path, err);
    }

    return true;
  };

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

  const getAll: GetAllRelations = async ({ parentSlug, ownerId, locale }) => {
    const relationTableName = tableName({
      owner: baseTableName(parentSlug),
      child: { kind: 'rels' }
    });

    // If the collection doesn't have relation
    // relationTableName doesn't exist
    // then there are no relations
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

    const all = await db
      .select()
      .from(table)
      .where(and(...conditions));

    return all as RelationRow[];
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
 * A relation write that failed. It used to be logged and swallowed, and the save went on without
 * the rows: thrown now, so the save fails instead of losing them quietly.
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
