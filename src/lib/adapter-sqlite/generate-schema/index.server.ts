import type { Config } from '$lib/core/config/types.js';
import { area, collection } from '$lib/core/prototype/index.js';
import { columnsOf, distinctFeatures, tablesOf } from '$lib/core/features/fold.js';
import { baseTableName, declaredTableProperty, type TableName } from '../naming.server.js';
import { date } from '$lib/fields/date/index.js';
import { toPascalCase } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import { generateRelationshipDefinitions } from './relations/definition.server.js';
import { generateJunctionTableDefinition } from './relations/junction.server.js';
import buildRootTable from './root.server.js';
import {
  templateDeclaredTable,
  templateExportRelationsFieldsToTable,
  templateExportSchema,
  templateExportTables,
  templateHead,
  templateImports,
  templateRelationMany,
  templateRelationOne
} from './templates.server.js';
import write from './write.server.js';

export async function generateSchemaString<T extends Config>(config: T) {
  // Every prototype config in the build, each paired with the features that extend its kind —
  // which is what says whether the config's content lives somewhere other than its own row.
  // One list rather than a loop per kind: the body below is two hundred lines and identical
  // for either.
  const allEntries = [
    ...(config.collections ?? []).map((c) => ({ features: collection.features, config: c })),
    ...(config.areas ?? []).map((a) => ({ features: area.features, config: a }))
  ];
  const entries = allEntries.filter((entry) => entry.config._generateSchema !== false);

  const schema: string[] = [templateImports];
  let enumTables: string[] = [];
  let enumRelations: string[] = [];
  let relationFieldsExportDic: Dic = {};
  const blocksRegister: string[] = [];

  for (const entry of entries) {
    const prototype = entry.config;

    // Whether this config's content lives on its own row or on a second table, asked of the
    // features that extend the prototype rather than of a member the adapter recognises by name.
    // A feature declaring a versions is the only thing that makes two tables here.
    const versions = (prototype as { _versions?: { slug: string } })._versions;

    // The prototype's own table, resolved from its slug rather than case-converted here —
    // a derived slug like `$someChild` has to lose its `$` and snake-case its segments.
    const baseName = baseTableName(prototype.slug);
    let rootTableName: TableName = baseName;
    let versionsRelationsDefinitions: string[] = [];

    schema.push(templateHead(baseName));

    if (versions) {
      // A versioned prototype is two tables: the base row keeps its own columns — `createdAt`,
      // `updatedAt` and whatever the config marks `._root()` — and everything else moves onto the
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
        featureColumns: columnsOf(entry.features, prototype),
        versionsOf: false,
        tableName: baseName
      });
      schema.push(baseSchema);

      // From here on, "root" means the versions: its blocks, tree and relations tables hang off it.
      rootTableName = baseTableName(versions.slug);

      const manyVersionsToOneName = `rel_${rootTableName}HasOne${toPascalCase(baseName)}`;
      const oneToManyVersionsName = `rel_${baseName}HasMany${toPascalCase(rootTableName)}`;

      versionsRelationsDefinitions = [
        templateRelationOne({
          name: manyVersionsToOneName,
          table: rootTableName,
          parent: baseName
        }),
        templateRelationMany({
          name: oneToManyVersionsName,
          table: baseName,
          many: [rootTableName]
        })
      ];

      enumTables = [...enumTables, baseName];
      enumRelations = [...enumRelations, manyVersionsToOneName, oneToManyVersionsName];
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
      featureColumns: columnsOf(entry.features, prototype),
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

    const { relationsDefinitions, relationsNames } = generateRelationshipDefinitions({
      relationsDic
    });

    const relationsTableNames = Object.values(relationsDic).flat();

    enumTables = Array.from(new Set([...enumTables, rootTableName, ...relationsTableNames]));
    enumRelations = [...enumRelations, ...relationsNames];
    relationFieldsExportDic = {
      ...relationFieldsExportDic,
      [rootTableName]: relationFieldsMap
    };

    schema.push(
      prototypeSchema,
      junctionTable,
      ...versionsRelationsDefinitions,
      relationsDefinitions
    );
  }

  // The tables the features in play own, which no prototype declares. Was `templateAuth` pushed
  // unconditionally plus `templateAPIKey` behind a `authConfig(prototype)?.type === 'apiKey'`
  // sniff — the generator reading a feature's config member to decide what to emit. Asked of the
  // whole config, which is the scope the question has.
  for (const table of tablesOf(distinctFeatures([collection, area]), config)) {
    schema.push(templateDeclaredTable(table));
    enumTables.push(declaredTableProperty(table.slug));
  }

  schema.push(templateExportTables(enumTables));
  schema.push(templateExportRelationsFieldsToTable(relationFieldsExportDic));
  schema.push(templateExportSchema({ enumTables, enumRelations }));

  return schema.join('\n').replace(/\n{3,}/g, '\n\n');
}

const generateSchema = async <T extends Config>(config: T) => {
  const result = await generateSchemaString(config);
  write(result);
};

export default generateSchema;
