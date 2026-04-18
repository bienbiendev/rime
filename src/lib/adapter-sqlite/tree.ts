import type { GenericAdapteFacadeArgs } from '$lib/adapter-sqlite/types.js';
import { withLocalesSuffix } from '$lib/core/naming.js';
import type { TreeBlock } from '$lib/core/types/doc.js';
import { extractFieldName } from '$lib/fields/tree/util.js';
import type { WithRequired } from '$lib/util/types.js';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { omit } from '../util/object.js';
import { toPascalCase } from '../util/string.js';
import { generatePK, transformDataToSchema } from './util.js';

const createTreeFacade = ({ db, tables }: GenericAdapteFacadeArgs) => {
  //
  const buildBlockTableName = (slug: string, blockPath: string) => {
    const [fieldName] = extractFieldName(blockPath);
    return `${slug}Tree${toPascalCase(fieldName)}`;
  };

  const update: UpdateBlock = async ({ parentSlug, block, locale }) => {
    const tableName = buildBlockTableName(parentSlug, block.path);
    const columns = getTableColumns(tables[tableName]);
    const values = transformDataToSchema(omit(['id'], block), columns);

    if (Object.keys(values).length) {
      await db.update(tables[tableName]).set(values).where(eq(tables[tableName].id, block.id));
    }

    const tableLocalesName = withLocalesSuffix(tableName);
    if (locale && tableLocalesName in tables) {
      const tableLocales = tables[tableLocalesName];
      const localizedColumns = getTableColumns(tableLocales);
      const localizedValues = transformDataToSchema(
        omit(['ownerId', 'id'], block),
        localizedColumns
      );

      if (!Object.keys(localizedValues).length) return true;

      //@ts-expect-error tableLocalesName is key of db.query
      const localizedRow = await db.query[tableLocalesName].findFirst({
        where: and(eq(tableLocales.ownerId, block.id), eq(tableLocales.locale, locale))
      });

      if (!localizedRow) {
        await db.insert(tableLocales).values({
          ...localizedValues,
          id: generatePK(),
          locale: locale,
          ownerId: block.id
        });
      } else {
        await db
          .update(tableLocales)
          .set(localizedValues)
          .where(and(eq(tableLocales.ownerId, block.id), eq(tableLocales.locale, locale)));
      }
    }
    return true;
  };

  const deleteBlock: DeleteBlock = async ({ parentSlug, block }) => {
    const table = buildBlockTableName(parentSlug, block.path);
    await db.delete(tables[table]).where(eq(tables[table].id, block.id));
    return true;
  };

  const create: CreateBlock = async ({ parentSlug, block, ownerId, locale }) => {
    const table = buildBlockTableName(parentSlug, block.path);
    const blockId = generatePK();
    const tableLocales = withLocalesSuffix(table);

    if (locale && tableLocales in tables) {
      const unlocalizedColumns = getTableColumns(tables[table]);
      const localizedColumns = getTableColumns(tables[tableLocales]);

      const unlocalizedData = transformDataToSchema(block, unlocalizedColumns);
      const localizedData = transformDataToSchema(block, localizedColumns);

      await db.insert(tables[table]).values({
        ...unlocalizedData,
        id: blockId,
        ownerId: ownerId,
        locale
      });

      await db.insert(tables[tableLocales]).values({
        ...localizedData,
        id: generatePK(),
        ownerId: blockId,
        locale
      });
    } else {
      const columns = getTableColumns(tables[table]);
      const schemaData = transformDataToSchema(block, columns);

      await db.insert(tables[table]).values({
        ...schemaData,
        ownerId,
        id: generatePK()
      });
    }
    return true;
  };

  const getBlocksTableNames = (slug: string): string[] =>
    Object.keys(tables).filter((key) => key.startsWith(`${slug}Tree`) && !key.endsWith('Locales'));

  return {
    getBlocksTableNames,
    delete: deleteBlock,
    create,
    update
  };
};

export default createTreeFacade;

/****************************************************/
/* Types
/****************************************************/

type UpdateBlock = (args: {
  parentSlug: string;
  block: WithRequired<TreeBlock, 'path'>;
  locale?: string;
}) => Promise<boolean>;

type CreateBlock = (args: {
  parentSlug: string;
  block: WithRequired<TreeBlock, 'path'>;
  ownerId: string;
  locale?: string;
}) => Promise<boolean>;

type DeleteBlock = (args: {
  parentSlug: string;
  block: WithRequired<TreeBlock, 'path'>;
}) => Promise<boolean>;
