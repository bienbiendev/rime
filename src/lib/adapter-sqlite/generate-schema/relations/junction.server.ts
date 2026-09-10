import { tableName as buildTableName } from '../../naming.server.js';
import { templateRelationFieldsTable } from '../templates.server.js';
import type { RelationFieldsMap } from '../root.server.js';
import type { TableName } from '../../naming.server.js';

/**
 * Generates a junction table definition for many-to-many relationships
 * Takes a table name, its relation fields mapping, and locale flag to create:
 * - A junction table (e.g., 'pagesRels') with references to related tables
 *
 * @example
 * {
 *   junctionTable: `
 *     export const pagesRels = sqliteTable('pages_rels', {
 *       id: pk(),
 *       path: text('path'),
 *       position: integer('position'),
 *       ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' }),
 *       mediasId: text('media_id').references(() => medias.id, { onDelete: 'cascade' }),
 *       locale: text('locale')
 *     })`,
 *   junctionTableName: 'pagesRels'
 * }
 */
export function generateJunctionTableDefinition(args: Args): Return {
  const { tableName, relationFieldsMap, hasLocale } = args;
  let junctionTable = '';
  const relsTableName = buildTableName({ owner: tableName, child: { kind: 'rels' } });
  const tablesRelationsTo = [...new Set(Object.values(relationFieldsMap).map((r) => r.to))];
  if (tablesRelationsTo.length) {
    // The table only. There was a `relations(pages, ({ many }) => ({ medias: many(medias) }))`
    // beside it, and nothing ever traversed it — every `with` a read builds names a child table
    // (blocks, tree, locales, rels), never a target collection. Relation *fields* are resolved by
    // `relations.server.ts` with its own selects against this junction.
    junctionTable = templateRelationFieldsTable({
      table: tableName,
      junctionTable: relsTableName,
      relations: tablesRelationsTo,
      hasLocale
    });
  }
  return {
    junctionTable,
    junctionTableName: relsTableName
  };
}

type Args = {
  tableName: TableName;
  relationFieldsMap: RelationFieldsMap;
  hasLocale: boolean;
};

type Return = {
  junctionTable: string;
  junctionTableName: string;
};
