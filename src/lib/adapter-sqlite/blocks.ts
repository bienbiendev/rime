import type { GenericAdapteFacadeArgs } from '$lib/adapter-sqlite/types.js';
import { withLocalesSuffix } from '$lib/core/naming.js';
import type { GenericBlock } from '$lib/core/types/doc.js';
import type { WithOptional } from '$lib/util/types.js';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { omit } from '../util/object.js';
import { toPascalCase } from '../util/string.js';
import { generatePK, transformDataToSchema } from './util.js';

const createBlocksFacade = ({ db, tables }: GenericAdapteFacadeArgs) => {
  const buildBlockTableName = (slug: string, blockName: string) =>
    `${slug}Blocks${toPascalCase(blockName)}`;

  const update: UpdateBlock = async ({ parentSlug, block, locale }) => {
    const table = buildBlockTableName(parentSlug, block.type);
    const columns = getTableColumns(tables[table]);
    const values = transformDataToSchema(omit(['id'], block), columns);

    if (Object.keys(values).length) {
      await db.update(tables[table]).set(values).where(eq(tables[table].id, block.id));
    }

    const keyTableLocales = withLocalesSuffix(table);
    if (locale && keyTableLocales in tables) {
      const tableLocales = tables[keyTableLocales];
      const localizedColumns = getTableColumns(tableLocales);
      const localizedValues = transformDataToSchema(
        omit(['ownerId', 'id'], block),
        localizedColumns
      );

      if (!Object.keys(localizedValues).length) return true;

      //@ts-expect-error keyTableLocales is key of db.query
      const localizedRow = await db.query[keyTableLocales].findFirst({
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
    const table = buildBlockTableName(parentSlug, block.type);
    await db.delete(tables[table]).where(eq(tables[table].id, block.id));
    return true;
  };

  const create: CreateBlock = async ({ parentSlug, block, ownerId, locale }) => {
    const tableName = buildBlockTableName(parentSlug, block.type);
    const blockId = generatePK();
    const tableNameLocales = withLocalesSuffix(tableName);

    if (locale && tableNameLocales in tables) {
      const unlocalizedColumns = getTableColumns(tables[tableName]);
      const localizedColumns = getTableColumns(tables[tableNameLocales]);

      const unlocalizedData = transformDataToSchema(block, unlocalizedColumns);
      const localizedData = transformDataToSchema(block, localizedColumns);

      await db.insert(tables[tableName]).values({
        ...unlocalizedData,
        id: blockId,
        ownerId: ownerId,
        locale
      });

      await db.insert(tables[tableNameLocales]).values({
        ...localizedData,
        id: generatePK(),
        ownerId: blockId,
        locale
      });
    } else {
      const columns = getTableColumns(tables[tableName]);
      const schemaData = transformDataToSchema(block, columns);

      await db.insert(tables[tableName]).values({
        ...schemaData,
        ownerId,
        id: generatePK()
      });
    }
    return true;
  };

  const getBlocksTableNames = (slug: string): string[] =>
    Object.keys(tables).filter(
      (key) => key.startsWith(`${slug}Blocks`) && !key.endsWith('Locales')
    );

  return {
    getBlocksTableNames,
    delete: deleteBlock,
    create,
    update
  };
};

export default createBlocksFacade;

/****************************************************/
/* Types
/****************************************************/

type UpdateBlock = (args: {
  parentSlug: string;
  block: GenericBlock;
  locale?: string;
}) => Promise<boolean>;

type CreateBlock = (args: {
  parentSlug: string;
  block: WithOptional<GenericBlock, 'id'>;
  ownerId: string;
  locale?: string;
}) => Promise<boolean>;

type DeleteBlock = (args: { parentSlug: string; block: GenericBlock }) => Promise<boolean>;
