import type { BuiltConfig } from '$lib/core/config/types.js';
import { authColumns } from '$lib/core/auth/tables.js';
import { baseTableName, declaredTableProperty, type TableName } from '../naming.server.js';
import { date } from '$lib/fields/date/index.js';
import type { Dic } from '$lib/util/types.js';
import { generateJunctionTableDefinition } from './relations/junction.server.js';
import buildRootTable from './root.server.js';
import {
  templateDeclaredTable,
  templateExportRelationsFieldsToTable,
  templateExportSchema,
  templateExportTables,
  templateHead,
  templateImports,
  templateRelations
} from './templates.server.js';
import write from './write.server.js';

export async function generateSchemaString(config: BuiltConfig) {
  // Every prototype config in the build, each paired with the features that extend its kind —
  // which is what says whether the config's content lives somewhere other than its own row.
  // One list rather than a loop per kind: the body below is two hundred lines and identical
  // for either.
  const allEntries = [
    ...config.collections.map((config) => ({ config })),
    ...config.areas.map((config) => ({ config }))
  ];
  const entries = allEntries.filter((entry) => entry.config._generateSchema !== false);

  const schema: string[] = [templateImports];
  let enumTables: string[] = [];
  /** parent table -> its child tables, for the one `defineRelations` at the end. */
  const relationTree: Record<string, string[]> = {};
  let relationFieldsExportDic: Dic = {};
  const blocksRegister: string[] = [];

  for (const entry of entries) {
    const prototype = entry.config;

    // Whether this config's content lives on its own row or on a second table, asked of the
    // features that extend the prototype rather than of a member the adapter recognises by name.
    // A feature declaring a versions table is the only thing that makes two tables here.
    const versions = prototype._versions;

    // The prototype's own table, resolved from its slug rather than case-converted here —
    // a derived slug like `$someChild` has to lose its `$` and snake-case its segments.
    const baseName = baseTableName(prototype.slug);
    let rootTableName: TableName = baseName;

    schema.push(templateHead(baseName));

    if (versions) {
      // A versioned prototype is two tables: the base row keeps its own columns — `createdAt`,
      // `updatedAt` and whatever the config marks `$root()` — and everything else moves onto the
      // versions, which is what the rest of this iteration then builds.
      const { schema: baseSchema } = await buildRootTable({
        blocksRegister: [],
        fields: [
          ...prototype.fields.filter((field) => field.get.root),
          date('createdAt').hidden(),
          date('updatedAt').hidden()
        ],
        rootName: baseName,
        locales: [],
        featureColumns: authColumns(prototype),
        versionsOf: false,
        tableName: baseName
      });
      schema.push(baseSchema);

      // From here on, "root" means the versions table: its blocks, tree and relations tables hang off it.
      rootTableName = baseTableName(versions.slug);

      enumTables = [...enumTables, baseName];
      (relationTree[baseName] ??= []).push(rootTableName);
    }

    const {
      schema: prototypeSchema,
      relationsDic,
      relationFieldsMap,
      relationFieldsHasLocale
    } = await buildRootTable({
      blocksRegister,
      fields: versions ? prototype.fields.filter((field) => !field.get.root) : prototype.fields,
      rootName: rootTableName,
      locales: config.localization?.locales || [],
      featureColumns: authColumns(prototype),
      versionsOf: versions ? baseName : false,
      tableName: rootTableName
    });

    const { junctionTable, junctionTableName } = generateJunctionTableDefinition({
      tableName: rootTableName,
      relationFieldsMap,
      hasLocale: relationFieldsHasLocale
    });

    if (junctionTable.length) {
      relationsDic[rootTableName] ??= [];
      relationsDic[rootTableName].push(junctionTableName);
    }

    const relationsTableNames = Object.values(relationsDic).flat();

    enumTables = Array.from(new Set([...enumTables, rootTableName, ...relationsTableNames]));
    for (const [parent, children] of Object.entries(relationsDic)) {
      (relationTree[parent] ??= []).push(...children);
    }
    relationFieldsExportDic = {
      ...relationFieldsExportDic,
      [rootTableName]: relationFieldsMap
    };

    schema.push(prototypeSchema, junctionTable);
  }

  // Tables no prototype declares — better-auth's own, plus whatever a plugin added during the
  // configure phase. Nothing here knows who asked for one.
  for (const table of config.$tables) {
    schema.push(templateDeclaredTable(table));
    enumTables.push(declaredTableProperty(table.slug));
  }

  schema.push(templateExportTables(enumTables));
  // After `tables`, which `defineRelations` takes as its first argument.
  schema.push(templateRelations(relationTree));
  schema.push(templateExportRelationsFieldsToTable(relationFieldsExportDic));
  schema.push(templateExportSchema({ enumTables }));

  return schema.join('\n').replace(/\n{3,}/g, '\n\n');
}

const generateSchema = async (config: BuiltConfig) => {
  const result = await generateSchemaString(config);
  write(result);
};

export default generateSchema;
