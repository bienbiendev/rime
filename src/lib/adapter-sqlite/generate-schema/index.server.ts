import type { BuiltConfig } from '#lib/core/config/types.js';
import { authColumns } from '#lib/core/auth/tables.js';
import {
  baseTableName,
  declaredTableProperty,
  tableName,
  type TableName
} from '../naming.server.js';
import { date } from '#lib/fields/date/index.js';
import { generateJunctionTableDefinition } from './relations/junction.server.js';
import buildRootTable, { type ReferenceJoin } from './root.server.js';
import {
  templateDeclaredTable,
  templateExportSchema,
  templateExportTables,
  templateHead,
  templateImports,
  templatePathsTable,
  templateRelations
} from './templates.server.js';
import write from './write.server.js';

async function generateSchemaString(config: BuiltConfig) {
  // Every prototype config that generates a schema, collections and areas alike.
  const prototypes = [...config.collections, ...config.areas].filter(
    (prototype) => prototype._generateSchema !== false
  );

  const schema: string[] = [templateImports];
  let enumTables: string[] = [];
  /** parent table -> its child tables, for the one `defineRelations` at the end. */
  const relationTree: Record<string, string[]> = {};
  const blocksRegister: string[] = [];
  /** Every resolved reference, joined onto its owner in the same `defineRelations`. */
  const referenceJoins: ReferenceJoin[] = [];

  for (const prototype of prototypes) {
    // A versions table moves the config's content off its own row onto a second table.
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
      const { schema: baseSchema, referenceJoins: baseReferenceJoins } = await buildRootTable({
        blocksRegister: [],
        fields: [
          ...prototype.fields.filter((field) => field.get.root),
          date('createdAt').hidden(),
          date('updatedAt').hidden().$index()
        ],
        rootName: baseName,
        locales: [],
        featureColumns: authColumns(prototype),
        versionsOf: false,
        tableName: baseName
      });
      schema.push(baseSchema);
      referenceJoins.push(...baseReferenceJoins);

      // From here on, "root" means the versions table: its blocks, tree and relations tables hang off it.
      rootTableName = baseTableName(versions.slug);

      enumTables = [...enumTables, baseName];
      (relationTree[baseName] ??= []).push(rootTableName);
    }

    const {
      schema: prototypeSchema,
      relationsDic,
      relationTargets,
      relationFieldsHasLocale,
      referenceJoins: contentReferenceJoins
    } = await buildRootTable({
      blocksRegister,
      fields: versions ? prototype.fields.filter((field) => !field.get.root) : prototype.fields,
      rootName: rootTableName,
      locales: config.localization?.locales || [],
      featureColumns: authColumns(prototype),
      versionsOf: versions ? baseName : false,
      tableName: rootTableName
    });
    referenceJoins.push(...contentReferenceJoins);

    const { junctionTable, junctionTableName } = generateJunctionTableDefinition({
      tableName: rootTableName,
      relationTargets,
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
    schema.push(prototypeSchema, junctionTable);

    // A config with `$url` keeps its addresses in a table of their own, off the base table: an
    // address belongs to the document, not to one of its versions. An area's one row per locale
    // holds the area's slug and no parent.
    if (prototype.$url) {
      const pathsTable = tableName({ owner: baseName, child: { kind: 'paths' } });
      schema.push(templatePathsTable(baseName));
      enumTables = [...enumTables, pathsTable];
      (relationTree[baseName] ??= []).push(pathsTable);
    }
  }

  // Tables no prototype declares — better-auth's own, plus whatever a plugin added during the
  // configure phase. Nothing here knows who asked for one.
  for (const table of config.$tables) {
    schema.push(templateDeclaredTable(table));
    enumTables.push(declaredTableProperty(table.slug));
  }

  schema.push(templateExportTables(enumTables));
  // After `tables`, which `defineRelations` takes as its first argument.
  schema.push(templateRelations(relationTree, referenceJoins));
  schema.push(templateExportSchema({ enumTables }));

  return schema.join('\n').replace(/\n{3,}/g, '\n\n');
}

const generateSchema = async (config: BuiltConfig) => {
  const result = await generateSchemaString(config);
  write(result);
};

export default generateSchema;
