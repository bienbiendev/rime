import type { LocaleConfig } from '$lib/core/locale/types.js';
import type { FieldBuilder, NodeStorage } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { walkFields } from '$lib/core/fields/walk.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import type { Field, FormField } from '$lib/fields/types.js';
import { tableName as buildTableName, getSchemaColumnNames } from '../naming.server.js';
import { toSchemaColumn } from './column.server.js';
import type { TableName } from '../naming.server.js';
import {
  templateDeclaredColumn,
  templateLocale,
  templateParent,
  templateTable
} from './templates.server.js';
import type { ColumnDeclaration } from '$lib/core/adapter.js';

/** A relation field on a prototype: which collection it points at, and whether it is localized. */
export type RelationFieldsMap = Record<string, { to: string; localized?: boolean }>;

/** A reference the read resolves: the table and column holding the foreign key, and its target. */
export type ReferenceJoin = { table: TableName; column: string; to: string };

type Args = {
  fields: FieldBuilder<Field>[];
  tableName: TableName;
  rootName: TableName;
  locales?: LocaleConfig[];
  hasParent?: boolean;
  relationFieldsMap?: RelationFieldsMap;
  relationsDic?: Record<string, string[]>;
  /**
   * Storage-only columns to append to this config's table, in order.
   *
   * Appended as given; nothing here knows what asked for them.
   */
  featureColumns?: ColumnDeclaration[];
  /**
   * The base table this one holds the content of, when it is a versions table — it gets an `ownerId` pointing back at
   * it. Named after the relationship rather than after the feature that asks for one: what makes
   * a versions table is a feature declaring one, never a config member this module recognises.
   */
  versionsOf?: string | false;
  blocksRegister: string[];
};

type Return = {
  schema: string;
  relationFieldsMap: RelationFieldsMap;
  relationsDic: Record<string, string[]>;
  relationFieldsHasLocale: boolean;
  /** Every resolved reference on this table and its blocks and tree tables. */
  referenceJoins: ReferenceJoin[];
};

/** A container flattened into the owner's row: its name and the column's, joined. */
const joinColumn = (parent: string, part: string) => (parent ? `${parent}__${part}` : part);

/**
 * The table of a collection or area, its locales branch when a field is localized, and one child
 * table per block type and per tree field. Relation fields become no column; they are collected in
 * `relationFieldsMap` for the junction table built later.
 *
 * The branches below decide where a field's rows are stored, not what is below it:
 *
 * ```
 * relation                 junction rows      no column, an entry in relationFieldsMap
 * a node with storage      a child table      blocks and tree, built by this function recursing
 * a node without           the owner's row    group, tabs, and a container from a package
 * leaf                     one column
 * ```
 */
const buildRootTable = async ({
  fields: incomingFields,
  tableName,
  rootName,
  hasParent,
  locales,
  relationFieldsMap = {},
  relationsDic = {},
  featureColumns = [],
  versionsOf,
  blocksRegister
}: Args): Promise<Return> => {
  const blocksTables: string[] = [];
  const referenceJoins: ReferenceJoin[] = [];
  let relationFieldsHasLocale = false;

  /**
   * One child table under the root for a branch stored as rows of its own, built by recursing.
   * Registered once: two blocks fields declaring the same type share the type's table.
   */
  const childTable = async (storage: NodeStorage, fields: FieldBuilder<Field>[]) => {
    const name = buildTableName({ owner: rootName, child: storage });
    if (blocksRegister.includes(name)) return;

    relationsDic = { ...relationsDic, [rootName]: [...(relationsDic[rootName] || []), name] };
    const nested = await buildRootTable({
      blocksRegister,
      fields,
      tableName: name,
      hasParent: true,
      relationsDic,
      relationFieldsMap,
      locales,
      rootName
    });
    relationsDic = nested.relationsDic;
    relationFieldsMap = nested.relationFieldsMap;
    if (nested.relationFieldsHasLocale) relationFieldsHasLocale = true;
    referenceJoins.push(...nested.referenceJoins);
    blocksRegister.push(name);
    blocksTables.push(nested.schema);
  };

  const generateFieldsTemplates = async (
    fields: FieldBuilder<Field>[],
    withLocalized?: boolean,
    parentPath: string = ''
  ): Promise<string[]> => {
    let templates: string[] = [];

    const checkLocalized = (field: FormFieldBuilder<FormField>) => {
      return (
        (withLocalized && field.get.localized) ||
        (!withLocalized && !field.get.localized) ||
        withLocalized === undefined
      );
    };

    for (const field of fields) {
      // Junction rows: no column here, and the relations table wants to know it exists.
      if (field instanceof RelationFieldBuilder) {
        if (field.get.localized) {
          relationFieldsHasLocale = true;
        }
        relationFieldsMap = {
          ...relationFieldsMap,
          [field.name]: {
            to: field.get.relationTo,
            localized: field.get.localized
          }
        };
      } else if (field.use.nodes().length) {
        // A branch stored as rows of its own gets a child table; any other flattens into the
        // owner's row, `attributes__seo__title`.
        for (const node of field.use.nodes()) {
          if (node.storage) {
            await childTable(node.storage, node.fields);
            continue;
          }
          const own = field.name ? joinColumn(parentPath, field.name) : parentPath;
          const prefix = node.segment ? joinColumn(own, node.segment) : own;
          templates = [
            ...templates,
            ...(await generateFieldsTemplates(node.fields, withLocalized, prefix))
          ];
        }
      } else if (field instanceof FormFieldBuilder) {
        if (checkLocalized(field)) {
          templates.push(toSchemaColumn(field, parentPath) + ',');
          // A reference the read resolves gets a relation to its target beside the column.
          if (field._references?.resolve) {
            referenceJoins.push({
              table: tableName,
              column: getSchemaColumnNames({ name: field.name, parentPath }).camel,
              to: field._references.table
            });
          }
        }
      }
    }
    return templates;
  };

  let table: string;

  if (locales && locales.length && hasLocalizedField(incomingFields)) {
    const tableNameLocales = buildTableName({ owner: tableName, branch: 'locales' });
    const strLocalizedFields = await generateFieldsTemplates(incomingFields, true);
    relationsDic[tableName] = [...(relationsDic[tableName] || []), tableNameLocales];
    const strUnlocalizedFields = await generateFieldsTemplates(incomingFields, false);
    if (hasParent) {
      strUnlocalizedFields.push(templateParent(rootName));
    }
    if (versionsOf) {
      strUnlocalizedFields.push(templateParent(versionsOf));
    }
    for (const column of featureColumns) {
      strUnlocalizedFields.push(templateDeclaredColumn(column) + ',');
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
    if (versionsOf) {
      strFields.push(templateParent(versionsOf));
    }
    for (const column of featureColumns) {
      strFields.push(templateDeclaredColumn(column) + ',');
    }
    table = templateTable(tableName, strFields.join('\n  '));
  }

  return {
    schema: [table, ...blocksTables].join('\n\n'),
    relationFieldsMap,
    relationFieldsHasLocale,
    relationsDic,
    referenceJoins
  };
};

/** Whether anything in the tree is localized, container fields included. */
const hasLocalizedField = (fields: FieldBuilder<Field>[]): boolean =>
  [...walkFields(fields)].some((visit) => visit.field.get.localized);

export default buildRootTable;
