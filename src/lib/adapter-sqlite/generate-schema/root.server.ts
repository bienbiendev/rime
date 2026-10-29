import type { ColumnDeclaration } from '#lib/core/adapter.js';
import type { FieldBuilder, NodeStorage } from '#lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { LocaleConfig } from '#lib/core/locale/types.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import type { Field, FormField } from '#lib/fields/types.js';
import type { TableName } from '../naming.server.js';
import { tableName as buildTableName, getSchemaColumnNames } from '../naming.server.js';
import { toSchemaColumn } from './column.server.js';
import {
  templateDeclaredColumn,
  templateLocale,
  templateParent,
  templateTable
} from './templates.server.js';

/** The collections the prototype's relation fields point at, each once. */
export type RelationTargets = Set<string>;

/** A reference the read resolves: the table and column holding the foreign key, and its target. */
export type ReferenceJoin = { table: TableName; column: string; to: string };

type Args = {
  fields: FieldBuilder<Field>[];
  tableName: TableName;
  rootName: TableName;
  locales?: LocaleConfig[];
  hasParent?: boolean;
  relationTargets?: RelationTargets;
  /**
   * Parent table -> its child tables, for the `defineRelations` block. The nested calls add to
   * the same one.
   */
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
  relationTargets: RelationTargets;
  relationsDic: Record<string, string[]>;
  relationFieldsHasLocale: boolean;
  /** Every resolved reference on this table and its blocks and tree tables. */
  referenceJoins: ReferenceJoin[];
};

/** A container flattened into the owner's row: its name and the column's, joined. */
const joinColumn = (parent: string, part: string) => (parent ? `${parent}__${part}` : part);

/**
 * The table of a collection or area, its locales branch when a field is localized, and one child
 * table per block type and per tree field. Relation fields become no column; their targets are
 * collected in `relationTargets` for the junction table built later.
 *
 * The branches below decide where a field's rows are stored, not what is below it:
 *
 * ```
 * relation                 junction rows      no column, its target in relationTargets
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
  relationTargets = new Set(),
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

    (relationsDic[rootName] ??= []).push(name);
    const nested = await buildRootTable({
      blocksRegister,
      fields,
      tableName: name,
      hasParent: true,
      relationsDic,
      relationTargets,
      locales,
      rootName
    });
    if (nested.relationFieldsHasLocale) relationFieldsHasLocale = true;
    referenceJoins.push(...nested.referenceJoins);
    blocksRegister.push(name);
    blocksTables.push(nested.schema);
  };

  /**
   * The columns of one table, and in `indexed` the ones a field asked `$index()` for.
   * `withLocalized`: `true` keeps the localized leaves only (the locales branch), `false` the
   * others (the table), `undefined` all of them (a table with no branch).
   */
  const generateFieldsTemplates = async (
    fields: FieldBuilder<Field>[],
    withLocalized?: boolean,
    parentPath: string = '',
    indexed: string[] = []
  ): Promise<string[]> => {
    let templates: string[] = [];

    /** Whether `field` is a column of the table being built: see `withLocalized`. */
    const checkLocalized = (field: FormFieldBuilder<FormField>) => {
      return (
        (withLocalized && field.get.localized) ||
        (!withLocalized && !field.get.localized) ||
        withLocalized === undefined
      );
    };

    for (const field of fields) {
      // Junction rows: no column here, and the relations table wants to know it exists.
      if (isRelationField(field)) {
        if (field.get.localized) {
          relationFieldsHasLocale = true;
        }
        relationTargets.add(field.get.relationTo);
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
            ...(await generateFieldsTemplates(node.fields, withLocalized, prefix, indexed))
          ];
        }
      } else if (field instanceof FormFieldBuilder) {
        if (checkLocalized(field)) {
          templates.push(toSchemaColumn(field, parentPath) + ',');
          if (field.get.index) {
            indexed.push(getSchemaColumnNames({ name: field.name, parentPath }).camel);
          }
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

  // A child row is read by its owner. A field's `$index()` adds its own column below.
  const indexed = hasParent || versionsOf ? ['ownerId'] : [];
  // A locales branch takes the localized columns and the table keeps the others. With no
  // branch, the table keeps them all.
  const hasBranch = !!locales?.length && hasLocalizedField(incomingFields);
  const branchName = buildTableName({ owner: tableName, branch: 'locales' });
  const branchIndexed: string[] = [];

  const localized = hasBranch
    ? await generateFieldsTemplates(incomingFields, true, '', branchIndexed)
    : [];
  const own = await generateFieldsTemplates(
    incomingFields,
    hasBranch ? false : undefined,
    '',
    indexed
  );
  const tail = [
    hasParent && templateParent(rootName),
    versionsOf && templateParent(versionsOf),
    ...featureColumns.map((column) => templateDeclaredColumn(column) + ',')
  ].filter(Boolean);

  let table = templateTable(tableName, [...own, ...tail].join('\n  '), indexed);
  if (hasBranch) {
    (relationsDic[tableName] ??= []).push(branchName);
    table += templateTable(
      branchName,
      [...localized, templateLocale(), templateParent(tableName)].join('\n  '),
      ['ownerId', ...branchIndexed]
    );
  }

  return {
    schema: [table, ...blocksTables].join('\n\n'),
    relationTargets,
    relationFieldsHasLocale,
    relationsDic,
    referenceJoins
  };
};

/** Whether anything in the tree is localized, container fields included. */
const hasLocalizedField = (fields: FieldBuilder<Field>[]): boolean =>
  [...walkFields(fields)].some((visit) => visit.field.get.localized);

export default buildRootTable;
