import type { GenericAdapteFacadeArgs } from '$lib/adapter-sqlite/types.server.js';
import { baseTableName, tableName } from './naming.server.js';
import type { BeforeOperationRelation, Relation } from '$lib/fields/relation/index.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { omit } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import { and, eq, getTableColumns, inArray, isNull, or, type SQLWrapper } from 'drizzle-orm';
import { transformDataToSchema } from './util.server.js';

const createRelationsFacade = ({ db, tables }: GenericAdapteFacadeArgs) => {
  //
  const deleteFromPaths: DeleteFromPaths = async ({ parentSlug, ownerId, paths, locale }) => {
    if (paths.length === 0) return true;

    const relationTableName = tableName({ owner: baseTableName(parentSlug), child: { kind: 'rels' } });
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
      .filter((row) => paths.some((path) => row.path.startsWith(path)))
      .map((row) => row.id);

    if (!toDelete.length) return true;

    await db.delete(table).where(inArray(table.id, toDelete));

    return true;
  };

  const create: Create = async ({ parentSlug, ownerId, relations }) => {
    const relationTableName = tableName({ owner: baseTableName(parentSlug), child: { kind: 'rels' } });
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
        console.error('error in sqlite/relations create' + err.message);
        return false;
      }
    }
    return true;
  };

  const update: Update = async ({ parentSlug, relations }) => {
    const relationTableName = tableName({ owner: baseTableName(parentSlug), child: { kind: 'rels' } });
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
      console.error('error in sqlite/relations update' + err.message);
      return false;
    }

    return true;
  };

  const deleteRelations: Delete = async ({ parentSlug, relations }) => {
    const relationTableName = tableName({ owner: baseTableName(parentSlug), child: { kind: 'rels' } });
    const table = tables[relationTableName];

    if (relations.length === 0) return true;

    const documentIds = relations
      .map((rel) => rel.id)
      .filter((id): id is string => id !== undefined);
    if (documentIds.length === 0) return true;

    try {
      await db.delete(table).where(inArray(table.id, documentIds));
    } catch (err: any) {
      console.error('error in sqlite/relations delete' + err.message);
      return false;
    }

    return true;
  };

  const getAll: GetAllRelations = async ({ parentSlug, ownerId, locale }) => {
    const relationTableName = tableName({ owner: baseTableName(parentSlug), child: { kind: 'rels' } });

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

    return all as Relation[];
  };

  return {
    create,
    update,
    delete: deleteRelations,
    deleteFromPaths,
    getAll
  };
};

export default createRelationsFacade;


type DeleteFromPaths = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  paths: string[];
  locale?: string;
}) => Promise<boolean>;

type Delete = (args: { parentSlug: PrototypeSlug; relations: Relation[] }) => Promise<boolean>;
type Update = (args: { parentSlug: PrototypeSlug; relations: Relation[] }) => Promise<boolean>;
type Create = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  relations: BeforeOperationRelation[];
}) => Promise<boolean>;

type GetAllRelations = (args: {
  parentSlug: PrototypeSlug;
  ownerId: string;
  locale?: string;
}) => Promise<Relation[]>;
