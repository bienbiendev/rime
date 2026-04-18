import { templateRelationFieldsTable, templateRelationMany } from '../templates.server.js';
import type { RelationFieldsMap } from './definition.server.js';

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
  const relationName = `rel_${tableName}Rels`;
  const tablesRelationsTo = [...new Set(Object.values(relationFieldsMap).map((r) => r.to))];
  if (tablesRelationsTo.length) {
    junctionTable = [
      templateRelationFieldsTable({ table: tableName, relations: tablesRelationsTo, hasLocale }),
      templateRelationMany({ name: relationName, table: tableName, many: tablesRelationsTo })
    ].join('\n');
  }
  return {
    junctionTable,
    junctionTableName: `${tableName}Rels`
  };
}

type Args = {
  tableName: string;
  relationFieldsMap: RelationFieldsMap;
  hasLocale: boolean;
};

type Return = {
  junctionTable: string;
  junctionTableName: string;
};
