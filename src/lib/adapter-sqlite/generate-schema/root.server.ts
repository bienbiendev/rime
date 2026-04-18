import type { LocaleConfig } from '$lib/core/config/types.js';
import { type FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import { withLocalesSuffix } from '$lib/core/naming.js';
import { isBlocksField } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder, isGroupField } from '$lib/fields/group/index.js';
import { getFieldPrivateModule } from '$lib/fields/index.server.js';
import { isRelationField } from '$lib/fields/relation/index.js';
import { isTabsField } from '$lib/fields/tabs/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { Field, FormField } from '$lib/fields/types.js';
import { toPascalCase } from '$lib/util/string.js';
import type { RelationFieldsMap } from './relations/definition.server.js';
import {
  templateHasAuth,
  templateLocale,
  templateParent,
  templateTable
} from './templates.server.js';
const p = toPascalCase;

type Args = {
  fields: FieldBuilder<Field>[];
  tableName: string;
  rootName: string;
  locales?: LocaleConfig[];
  hasParent?: boolean;
  relationFieldsMap?: RelationFieldsMap;
  relationsDic?: Record<string, string[]>;
  hasAuth?: boolean;
  versionsFrom?: string | false;
  blocksRegister: string[];
};

type Return = {
  schema: string;
  relationFieldsMap: RelationFieldsMap;
  relationsDic: Record<string, string[]>;
  relationFieldsHasLocale: boolean;
};

/**
 * This function generates the root table schema for collection/areas, including its localized version if needed,
 * and also generates tables for blocks and tree fields.
 * It also keeps track of relation fields and their localization status to properly generate relations later on.
 */
const buildRootTable = async ({
  fields: incomingFields,
  tableName,
  rootName,
  hasParent,
  locales,
  relationFieldsMap = {},
  relationsDic = {},
  hasAuth,
  versionsFrom,
  blocksRegister
}: Args): Promise<Return> => {
  const blocksTables: string[] = [];
  let relationFieldsHasLocale = false;

  const generateFieldsTemplates = async (
    fields: FieldBuilder<Field>[],
    withLocalized?: boolean,
    parentPath: string = ''
  ): Promise<string[]> => {
    let templates: string[] = [];

    const checkLocalized = (field: FormFieldBuilder<FormField>) => {
      return (
        (withLocalized && field.raw.localized) ||
        (!withLocalized && !field.raw.localized) ||
        withLocalized === undefined
      );
    };

    for (const field of fields) {
      if (field instanceof GroupFieldBuilder) {
        const groupPath = parentPath ? `${parentPath}__${field.name}` : field.name;
        const groupFields = await generateFieldsTemplates(
          field.raw.fields,
          withLocalized,
          groupPath
        );
        templates = [...templates, ...groupFields];
      } else if (isTabsField(field.raw)) {
        for (const tab of field.raw.tabs) {
          const tabPath = parentPath ? `${parentPath}__${tab.raw.name}` : tab.raw.name;
          const tabFields = await generateFieldsTemplates(tab.raw.fields, withLocalized, tabPath);
          templates = [...templates, ...tabFields];
        }
      } else if (isRelationField(field.raw)) {
        if (field.raw.localized) {
          relationFieldsHasLocale = true;
        }
        relationFieldsMap = {
          ...relationFieldsMap,
          [field.raw.name]: {
            to: field.raw.relationTo,
            localized: field.raw.localized
          }
        };
      } else if (isBlocksField(field.raw)) {
        for (const block of field.raw.blocks) {
          const blockTableName = `${rootName}Blocks${p(block.raw.name)}`;
          if (!blocksRegister.includes(blockTableName)) {
            // Add the blocks as a relation of the root collection
            relationsDic = {
              ...relationsDic,
              [rootName]: [...(relationsDic[rootName] || []), blockTableName]
            };
            // Build the child blocks table
            const {
              schema: blockTable,
              relationsDic: nestedRelationsDic,
              relationFieldsMap: nestedRelationFieldsDic,
              relationFieldsHasLocale: nestedRelationFieldsHasLocale
            } = await buildRootTable({
              blocksRegister,
              fields: block.raw.fields,
              tableName: blockTableName,
              hasParent: true,
              relationsDic,
              relationFieldsMap,
              locales,
              rootName
            });
            relationsDic = nestedRelationsDic;
            relationFieldsMap = nestedRelationFieldsDic;
            if (nestedRelationFieldsHasLocale) relationFieldsHasLocale = true;
            blocksRegister.push(blockTableName);
            blocksTables.push(blockTable);
          }
        }
      } else if (field instanceof TreeBuilder) {
        const treeTableName = `${rootName}Tree${p(field.name)}`;
        if (!blocksRegister.includes(treeTableName)) {
          // Add the tree table as relation of the root collection
          relationsDic = {
            ...relationsDic,
            [rootName]: [...(relationsDic[rootName] || []), treeTableName]
          };
          const {
            schema: treeTable,
            relationsDic: nestedRelationsDic,
            relationFieldsMap: nestedRelationFieldsDic,
            relationFieldsHasLocale: nestedRelationFieldsHasLocale
          } = await buildRootTable({
            blocksRegister,
            fields: field.raw.fields,
            tableName: treeTableName,
            hasParent: true,
            relationsDic,
            relationFieldsMap,
            locales,
            rootName
          });
          relationsDic = nestedRelationsDic;
          relationFieldsMap = nestedRelationFieldsDic;
          if (nestedRelationFieldsHasLocale) relationFieldsHasLocale = true;
          blocksRegister.push(treeTableName);
          blocksTables.push(treeTable);
        }
      } else if (field instanceof FormFieldBuilder) {
        if (checkLocalized(field)) {
          const serverField = await getFieldPrivateModule(field);
          if (serverField) {
            templates.push(serverField.toSchema(field, parentPath) + ',');
          }
        }
      }
    }
    return templates;
  };

  let table: string;

  if (locales && locales.length && hasLocalizedField(incomingFields)) {
    const tableNameLocales = withLocalesSuffix(tableName);
    const strLocalizedFields = await generateFieldsTemplates(incomingFields, true);
    relationsDic[tableName] = [...(relationsDic[tableName] || []), tableNameLocales];
    const strUnlocalizedFields = await generateFieldsTemplates(incomingFields, false);
    if (hasParent) {
      strUnlocalizedFields.push(templateParent(rootName));
    }
    if (versionsFrom) {
      strUnlocalizedFields.push(templateParent(versionsFrom));
    }
    if (hasAuth) {
      strUnlocalizedFields.push(templateHasAuth(rootName));
    }
    table = templateTable(tableName, strUnlocalizedFields.join('\n  '));
    table += templateTable(
      tableNameLocales,
      [...strLocalizedFields, templateLocale(), templateParent(tableName)].join('\n  ')
    );
  } else {
    const strFields = await generateFieldsTemplates(incomingFields);
    if (hasParent) {
      strFields.push(templateParent(rootName));
    }
    if (versionsFrom) {
      strFields.push(templateParent(versionsFrom));
    }
    if (hasAuth) {
      strFields.push(templateHasAuth(rootName));
    }
    table = templateTable(tableName, strFields.join('\n  '));
  }

  return {
    schema: [table, ...blocksTables].join('\n\n'),
    relationFieldsMap,
    relationFieldsHasLocale,
    relationsDic
  };
};

function hasLocalizedField(fields: FieldBuilder<Field>[]): boolean {
  // Iterate through each field in the array
  for (const field of fields) {
    // Case 1: If it's a group field, check all fields within the group
    if (isGroupField(field.raw)) {
      if (hasLocalizedField(field.raw.fields)) {
        return true;
      }
    }

    // Case 2: If it's a tabs field, check all fields within each tab
    else if (isTabsField(field.raw)) {
      for (const tab of field.raw.tabs) {
        if (hasLocalizedField(tab.raw.fields)) {
          return true;
        }
      }
    }

    // Case 3: If it's a blocks field, check all fields within each block
    else if (isBlocksField(field.raw)) {
      if (field.raw.localized) return true;
      for (const block of field.raw.blocks) {
        if (hasLocalizedField(block.raw.fields)) {
          return true;
        }
      }
    }

    // Case 3: If it's a tree field, check all fields
    else if (field instanceof TreeBuilder) {
      if (field.raw.localized) return true;
      if (hasLocalizedField(field.raw.fields)) {
        return true;
      }
    }

    // Case 4: For regular form fields, check if it's marked as localized
    else if (isFormField(field.raw) && field.raw.localized) {
      return true;
    }
  }

  // If no localized fields were found, return false
  return false;
}

export default buildRootTable;
