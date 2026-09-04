import type { CollectionAuthConfig, Config } from '$lib/core/config/types.js';
import type { BuiltPrototype } from '$lib/core/prototype/define.js';
import { prototypeConfigs } from '$lib/core/prototype/registry.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import { baseTableName, type TableName } from '../naming.server.js';
import { date } from '$lib/fields/date/index.js';
import { toPascalCase } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
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
  templateRelationOne
} from './templates.server.js';
import write from './write.server.js';

/**
 * `auth` is the auth feature's member, so it is present on the configs that declare it and absent
 * from the rest — asked of the config, never of the kind.
 */
const authConfig = (prototype: BuiltPrototype) =>
  'auth' in prototype ? (prototype.auth as CollectionAuthConfig | undefined) : undefined;

export async function generateSchemaString<T extends Config>(config: T) {
  // Every prototype config in the build, folded from the registry rather than read off
  // `collections` and `areas`: what a prototype is called is core's business, and a third kind
  // must not mean a third loop here.
  const prototypes = prototypeConfigs(config).filter(
    (prototype) => prototype._generateSchema !== false
  );

  const schema: string[] = [templateImports];
  let enumTables: string[] = [];
  let enumRelations: string[] = [];
  let relationFieldsExportDic: Dic = {};
  const blocksRegister: string[] = [];

  for (const prototype of prototypes) {
    // The prototype's own table, resolved from its slug rather than case-converted here —
    // a derived slug like $mediasDirectories has to lose its `$` and snake-case its segments.
    const baseName = baseTableName(prototype.slug);
    let rootTableName: TableName = baseName;
    let versionsRelationsDefinitions: string[] = [];

    schema.push(templateHead(baseName));

    if (prototype.versions) {
      // A versioned prototype is two tables: the base row keeps its own columns — `createdAt`,
      // `updatedAt` and whatever the config marks `._root()` — and everything else moves onto the
      // shadow, which is what the rest of this iteration then builds.
      const { schema: baseSchema } = await buildRootTable({
        blocksRegister: [],
        fields: [
          ...prototype.fields.filter((field) => field.get.root),
          date('createdAt').hidden(),
          date('updatedAt').hidden()
        ],
        rootName: baseName,
        locales: [],
        hasAuth: !!authConfig(prototype),
        versionsFrom: false,
        tableName: baseName
      });
      schema.push(baseSchema);

      // From here on, "root" means the shadow: its blocks, tree and relations tables hang off it.
      rootTableName = baseTableName(withVersionsSuffix(baseName));

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
      fields: prototype.versions
        ? prototype.fields.filter((field) => !field.get.root)
        : prototype.fields,
      rootName: rootTableName,
      locales: config.localization?.locales || [],
      hasAuth: !!authConfig(prototype),
      versionsFrom: prototype.versions ? baseName : false,
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

  const HAS_API_KEY = prototypes.some((prototype) => authConfig(prototype)?.type === 'apiKey');

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
