import { tableName as buildTableName } from '../../naming.server.js';
import { templateRelationFieldsTable } from '../templates.server.js';
import type { RelationTargets } from '../root.server.js';
import type { TableName } from '../../naming.server.js';

/**
 * The one junction table of a prototype: the rows of every relation field, told apart by `path`,
 * with one target column per related collection. `junctionTable` is empty when no relation field
 * points anywhere.
 *
 * @example
 * {
 *   junctionTable: `
 *     export const pages__$relations = sqliteTable('pages__$relations', {
 *       id: pk(),
 *       path: text('path'),
 *       position: integer('position'),
 *       ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' }),
 *       mediasId: text('medias_id').references(() => medias.id, { onDelete: 'cascade' }),
 *       locale: text('locale')
 *     })`,
 *   junctionTableName: 'pages__$relations'
 * }
 */
export function generateJunctionTableDefinition(args: Args): Return {
  const { tableName, relationTargets, hasLocale } = args;
  let junctionTable = '';
  const relsTableName = buildTableName({ owner: tableName, child: { kind: 'rels' } });
  const tablesRelationsTo = [...relationTargets];
  if (tablesRelationsTo.length) {
    // The table only: relation fields are resolved by `relations.server.ts` with its own selects
    // against this junction.
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
  relationTargets: RelationTargets;
  hasLocale: boolean;
};

type Return = {
  junctionTable: string;
  junctionTableName: string;
};
