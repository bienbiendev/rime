import type { Config } from '$lib/core/factory/config/types.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import { baseTableName } from '../naming.server.js';
import { date } from '$lib/fields/date/index.js';
import {
  toCamelCase,
  toCamelCasePreserveTrailingUnderscoreSuffix,
  toPascalCase,
  toSnakeCase
} from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import { toSchemaColumn } from './column.server.js';
import { generateRelationshipDefinitions } from './relations/definition.server.js';
import { generateJunctionTableDefinition } from './relations/junction.server.js';
import buildRootTable from './root.server.js';
import {
  templateAPIKey,
  templateAuth,
  templateExportRelationsFieldsToTable,
  templateExportSchema,
  templateExportTables,
  templateHead,
  templateImports,
  templateRelationMany,
  templateRelationOne,
  templateTable
} from './templates.server.js';
import write from './write.server.js';

export async function generateSchemaString<T extends Config>(config: T) {
  const collections = (config.collections || []).filter((c) => c._generateSchema !== false);
  const areas = (config.areas || []).filter((a) => a._generateSchema !== false);

  const schema: string[] = [templateImports];
  let enumTables: string[] = [];
  let enumRelations: string[] = [];
  let relationFieldsExportDic: Dic = {};
  const blocksRegister: string[] = [];

  for (const collection of collections) {
    // The prototype's own table, resolved from its slug rather than case-converted here —
    // a derived slug like $mediasDirectories has to lose its `$` and snake-case its segments.
    const collectionSlug = baseTableName(collection.slug);
    let rootTableName = collectionSlug;
    let versionsRelationsDefinitions: string[] = [];

    schema.push(templateHead(collectionSlug));

    if (collection.versions) {
      // Collection that have versions may need some fields forced on the root table and not root_versions
      // process the root table with these fields first then, handle versions related tables creation

      // 1. Process root table

      // base root fields for versioned tables
      const baseRootFields = [date('createdAt').hidden(), date('updatedAt').hidden()];

      // Split fields that should be used on the root table
      const rootFieldsFromConfig = [...collection.fields].filter((f) => f.get.root);
      const rootFields = [...rootFieldsFromConfig, ...baseRootFields];

      // Build the main root buildRootTable with only _root fields and created/updatedAt
      const { schema: rootCollectionSchema } = await buildRootTable({
        blocksRegister: [],
        fields: rootFields,
        rootName: rootTableName,
        locales: [],
        hasAuth: !!collection.auth,
        versionsFrom: false,
        tableName: rootTableName
      });
      // Ad the root table to the schema
      schema.push(rootCollectionSchema);

      // 2. Handle versions table rename and relation root <-> root_verions definition

      // overwrite the collection name with the _versions one to generate all table
      // eg. blocks, relation related to the _versions one
      rootTableName = baseTableName(withVersionsSuffix(collectionSlug));

      // create specific relations between root <-> root_verions
      const manyVersionsToOneName = `rel_${rootTableName}HasOne${toPascalCase(collectionSlug)}`;
      const oneToManyVersionsName = `rel_${collectionSlug}HasMany${toPascalCase(rootTableName)}`;

      versionsRelationsDefinitions = [
        templateRelationOne({
          name: manyVersionsToOneName,
          table: rootTableName,
          parent: collectionSlug
        }),
        templateRelationMany({
          name: oneToManyVersionsName,
          table: collectionSlug,
          many: [rootTableName]
        })
      ];

      // add the root table to :
      // export tables = { ... }
      enumTables = [...enumTables, collectionSlug];
      // add the root <-> root_versions relations to :
      // export schema = { ... }
      enumRelations = [...enumRelations, manyVersionsToOneName, oneToManyVersionsName];
    }

    const {
      schema: collectionSchema,
      relationsDic,
      relationFieldsMap,
      relationFieldsHasLocale
    } = await buildRootTable({
      blocksRegister,
      fields: collection.versions
        ? collection.fields.filter((f) => !f.get.root)
        : collection.fields,
      rootName: rootTableName,
      locales: config.localization?.locales || [],
      hasAuth: !!collection.auth,
      versionsFrom: collection.versions ? collectionSlug : false,
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

    // if (collection.upload) {
    // 	schema.push(templateDirectories(collection.slug));
    // 	enumTables = [...enumTables, withDirectoriesSuffix(collection.slug)];
    // }

    schema.push(
      collectionSchema,
      junctionTable,
      ...versionsRelationsDefinitions,
      relationsDefinitions
    );
  }

  /**
   * Areas
   */
  for (const area of areas) {
    const areaSlug = baseTableName(area.slug);
    let rootTableName = toSnakeCase(areaSlug);
    let versionsRelationsDefinitions: string[] = [];

    schema.push(templateHead(areaSlug));

    if (area.versions) {
      // For now, areas don't need to filter out fields with or without _root
      // as these fields would have no effect

      // Overrite
      rootTableName = baseTableName(withVersionsSuffix(areaSlug));
      const manyVersionsToOneName = `rel_${rootTableName}HasOne${toPascalCase(areaSlug)}`;
      const oneToManyVersionsName = `rel_${areaSlug}HasMany${toPascalCase(rootTableName)}`;

      const baseRootFields = [date('createdAt').hidden(), date('updatedAt').hidden()];

      const schemaResults = baseRootFields.map((field) => toSchemaColumn(field));
      schema.push(templateTable(areaSlug, schemaResults.join(',\n')));

      versionsRelationsDefinitions = [
        templateRelationOne({
          name: manyVersionsToOneName,
          table: rootTableName,
          parent: areaSlug
        }),
        templateRelationMany({
          name: oneToManyVersionsName,
          table: areaSlug,
          many: [rootTableName]
        })
      ];

      enumTables = [...enumTables, areaSlug];
      enumRelations = [...enumRelations, manyVersionsToOneName, oneToManyVersionsName];
    }

    const {
      schema: areaSchema,
      relationsDic,
      relationFieldsMap,
      relationFieldsHasLocale
    } = await buildRootTable({
      blocksRegister,
      fields: area.fields,
      rootName: rootTableName,
      locales: config.localization?.locales || [],
      tableName: rootTableName,
      versionsFrom: area.versions ? areaSlug : false
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

    const relationsTableNames = Array.from(new Set(Object.values(relationsDic).flat()));

    enumTables = [...enumTables, rootTableName, ...relationsTableNames];
    enumRelations = [...enumRelations, ...relationsNames];
    relationFieldsExportDic = {
      ...relationFieldsExportDic,
      [rootTableName]: relationFieldsMap
    };

    schema.push(areaSchema, junctionTable, ...versionsRelationsDefinitions, relationsDefinitions);
  }

  const HAS_API_KEY = collections.filter((c) => c.auth?.type === 'apiKey').length;

  schema.push(templateAuth);
  if (HAS_API_KEY) {
    schema.push(templateAPIKey);
    enumTables.push('apikey');
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
