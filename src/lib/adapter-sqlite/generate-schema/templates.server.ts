import type { FieldReference } from '$lib/core/fields/builders/form-field-builder.js';
import type { ColumnDeclaration, ColumnType, TableDeclaration } from '$lib/core/adapter.js';
import { toSnakeCase } from '$lib/util/string.js';
import { baseTableName, declaredTableProperty, getSchemaColumnNames } from '../naming.server.js';
import dedent from 'dedent';

const s = toSnakeCase;

/**
 * Generates the standard imports needed for Drizzle ORM schema definitions
 * Includes SQLite table definitions, relations, and a primary key helper function
 */
export const templateImports = `
import { text, integer, sqliteTable, real } from "drizzle-orm/sqlite-core";
import { relations } from 'drizzle-orm';

const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
`;

/**
 * Generates a basic table definition with a primary key
 * Takes a table name and optional content for additional columns
 *
 * @example
 * ```typescript
 * export const pages = sqliteTable('pages', {
 *   id: pk(),
 *   title: text('title'),
 *   content: text('content')
 * })
 * ```
 */
export const templateTable = (table: string, content: string): string => {
  if (!content.includes('id:')) {
    content = `id: pk(),\n${content}`;
  }
  return `export const ${table} = sqliteTable( '${table}', {
		${content}
	})
	`;
};

/**
 * Generates a locale field for internationalized tables
 *
 * @example
 * ```typescript
 * locale: text("locale"),
 * ```
 */
export const templateLocale = () => 'locale: text("locale"),';

/**
 * Generates an owner reference field for parent-child relationships
 * Creates a foreign key that references the parent table's id with cascade delete
 *
 * @example
 * ```typescript
 * ownerId: text("owner_id").references(() => pages.id, { onDelete: 'cascade' }),
 * ```
 */
export const templateParent = (parent: string) => {
  return `ownerId: text("owner_id").references(() => ${parent}.id, { onDelete: 'cascade' }),`;
};

/**
 * Generates a `.references(...)` suffix for a field-level foreign key,
 * used by column.server.ts's toSchemaColumn for fields configured via
 * FormFieldBuilder#$references(...).
 *
 * @example
 * ```typescript
 * .references(() => staff.id, { onDelete: 'cascade' })
 * ```
 */
export const templateReferences = ({
  table,
  onDelete,
  onUpdate,
  selfReferencing
}: FieldReference) => {
  // `table` is a prototype *slug* — every $references caller passes one (auth: 'staff',
  // the prototype's own slug, or a derived one). Resolving it here keeps
  // features out of table naming, which is the adapter's business.
  const referenced = baseTableName(table);
  const arrow = selfReferencing ? '(): any =>' : '() =>';
  const opts = [
    onDelete ? `onDelete: '${onDelete}'` : '',
    onUpdate ? `onUpdate: '${onUpdate}'` : ''
  ].filter(Boolean);
  const optsStr = opts.length ? `, { ${opts.join(', ')} }` : '';
  return `.references(${arrow} ${referenced}.id${optsStr})`;
};

/**
 * How a declared `ColumnType` is spelled in drizzle. The whole of what the adapter knows about a
 * feature's storage: six shapes, none of them named after anything.
 */
const COLUMN_EXPR: Record<ColumnType, (snake: string) => string> = {
  text: (snake) => `text('${snake}')`,
  integer: (snake) => `integer('${snake}')`,
  real: (snake) => `real('${snake}')`,
  boolean: (snake) => `integer('${snake}', { mode: 'boolean' })`,
  timestamp: (snake) => `integer('${snake}', { mode: 'timestamp' })`,
  timestampMs: (snake) => `integer('${snake}', { mode: 'timestamp_ms' })`,
  json: (snake) => `text('${snake}', { mode: 'json' })`
};

/**
 * One column of a `TableDeclaration`, or one a feature puts on a prototype's own table.
 *
 * A `references` names a slug, so it resolves here — the same rule `templateReferences` follows
 * for a field-level foreign key, and for the same reason: which table a slug lives in is the
 * adapter's business.
 *
 * @example
 * ```typescript
 * authUserId: text('auth_user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' })
 * ```
 */
export const templateDeclaredColumn = (column: ColumnDeclaration): string => {
  const { camel, snake } = getSchemaColumnNames({ name: column.name });
  const references = column.references
    ? `.references(() => ${declaredTableProperty(column.references.table)}.${column.references.column ?? 'id'}, { onDelete: '${column.references.onDelete ?? 'cascade'}' })`
    : '';

  return [
    `${camel}: ${COLUMN_EXPR[column.type](snake)}`,
    column.primary ? '.primaryKey()' : '',
    column.notNull ? '.notNull()' : '',
    column.unique ? '.unique()' : '',
    column.defaultValue !== undefined ? `.default(${JSON.stringify(column.defaultValue)})` : '',
    references
  ].join('');
};

/**
 * A table a feature declared: `templateAuth`, `templateAPIKey` and `templateDirectories` were
 * three hand-written copies of this, and the schema generator had to know each by name to push it.
 *
 * Exported under the slug's own name and stored under the snake-cased one — see
 * `declaredTableProperty`. No `pk()` default: a declaration says which column is the primary key.
 */
export const templateDeclaredTable = (table: TableDeclaration): string => `
export const ${declaredTableProperty(table.slug)} = sqliteTable('${baseTableName(table.slug)}', {
  ${table.columns.map(templateDeclaredColumn).join(',\n  ')}
});
`;

/**
 * Generates unique and required modifiers for a field
 * Combines .unique() and .notNull() based on field configuration
 *
 * @example
 * ```typescript
 * // For a unique and required field:
 * .unique().notNull()
 *
 * // For just a unique field:
 * .unique()
 *
 * // For just a required field:
 * .notNull()
 * ```
 */
export const templateUniqueRequired = (
  field: { unique?: boolean; required?: boolean },
  defaultValue?: string | number | boolean | object | unknown[]
) => {
  const { unique, required } = field;
  const defaultStr =
    required && defaultValue !== undefined ? `.default(${JSON.stringify(defaultValue)})` : '';
  return `${unique ? '.unique()' : ''}${required ? `.notNull()${defaultStr}` : ''}`;
};

/** Template rows Relation */

/**
 * Generates a one-to-one or many-to-one relationship definition
 * Creates a relation where the table has one parent
 *
 * @example
 * ```typescript
 * export const rel_pagesShadowHasOnePages = relations(pagesShadow, ({ one }) => ({
 *   pages: one(pages, {
 *     fields: [pagesShadow.ownerId],
 *     references: [pages.id],
 *   }),
 * }))
 * ```
 */
export const templateRelationOne = ({ name, table, parent }: RelationOneArgs): string => `
export const ${name} = relations(${table}, ({ one }) => ({
  ${parent} : one(${parent}, {
    fields: [${table}.ownerId],
    references: [${parent}.id],
  }),
}))
`;

/**
 * Generates a one-to-many relationship definition
 * Creates a relation where the table has many children
 *
 * @example
 * ```typescript
 * export const rel_pagesHasManyBlocks = relations(pages, ({ many }) => ({
 *   pagesBlocksParagraph: many(pagesBlocksParagraph),
 *   pagesBlocksImage: many(pagesBlocksImage),
 * }))
 * ```
 */
export const templateRelationMany = ({ name, table, many }: RelationManyArgs): string => `
export const ${name} = relations(${table}, ({ many }) => ({
  ${many.map((child) => `${child}: many(${child}),`).join('\n')}
}))
`;

/** Templates Field Relations */

/**
 * Generates a foreign key column for a relation field
 * Creates a reference to another table's primary key with cascade delete
 *
 * @example
 * ```typescript
 * mediasId: text('medias_id').references(() => medias.id, { onDelete: 'cascade' })
 * ```
 */
export const templateFieldRelationColumn = (table: string) => {
  return `${table}Id:  text('${s(table)}_id').references(() => ${table}.id, { onDelete: 'cascade' })`;
};

/**
 * Generates a junction table for many-to-many relationships
 * Creates a table with references to the owner table and related tables
 * Includes path and position fields for ordering relationships
 *
 * @example
 * ```typescript
 * export const pagesRels = sqliteTable('pages_rels', {
 *   id: pk(),
 *   path: text('path'),
 *   position: integer('position'),
 *   ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' }),
 *   mediasId: text('medias_id').references(() => medias.id, { onDelete: 'cascade' }),
 *   locale: text('locale'),
 * })
 * ```
 */
export const templateRelationFieldsTable = ({
  table,
  junctionTable,
  relations,
  hasLocale
}: FieldsRelationTableArgs) => `
export const ${junctionTable} = sqliteTable('${junctionTable}', {
  id: pk(),
  path: text('path'),
  position: integer('position'),
  ${templateParent(table)}
  ${relations.map((rel) => templateFieldRelationColumn(rel)).join(',\n')},
  ${hasLocale ? `locale: text('locale'),` : ''}
})
`;

/**
 * Generates an export of relation field mappings for runtime use
 * Creates a record mapping table names to their relation configurations
 *
 * @example
 * ```typescript
 * export const relationFieldsMap: Record<string, any> = {
 *   pages: {"medias":{"to":"medias"},"categories":{"to":"categories"}}
 * }
 * ```
 */
export const templateExportRelationsFieldsToTable = (relationFieldsDic: Record<string, string>) => {
  const content = [];
  for (const [table, dic] of Object.entries(relationFieldsDic)) {
    content.push(dedent`
      ${table} : ${JSON.stringify(dic)}
    `);
  }
  return dedent`
    export const relationFieldsMap: Record<string, any> = {
      ${content.join(',\n      ')}
    }
  `;
};

/**
 * Generates an export of all tables for runtime use
 * Creates a record with all table definitions and proper TypeScript types
 *
 * @example
 * ```typescript
 * export const tables = {
 *   pages,
 *   pagesBlocksParagraph,
 *   pagesBlocksImage
 * }
 * ```
 */
export const templateExportTables = (tables: string[]): string => dedent`

  export const tables = {
    ${tables.join(',\n    ')}
  }
`;

/**
 * Generates the final schema export with all tables and relations
 * Creates a schema object and exports it with proper TypeScript types
 *
 * @example
 * ```typescript
 * const schema = {
 *   pages,
 *   pagesShadow,
 *   rel_pagesShadowHasOnePages,
 *   rel_pagesHasManyShadow
 * }
 *
 * declare module 'rimecms' {
 *   export interface RegisterSchema {
 *      schema: typeof schema;
 * 	 }
 * }
 * export default schema
 * ```
 */
export const templateExportSchema = ({ enumTables, enumRelations }: TemplateExportSchemaArgs) => `
const schema = {
	${enumTables.join(',\n      ')}${enumRelations.length ? ',\n      ' + enumRelations.join(',\n      ') : ''}
}

declare module 'rimecms' {
	export interface RegisterSchema {
			schema: typeof schema;
			tables: typeof tables;
	}
}
export default schema
 `;

/**
 * Generates a section header for a collection or area in the schema
 * Creates a visual separator with the slug name
 */
export const templateHead = (slug: string) => dedent`
  /** ${slug} ============================================== **/`;

type RelationOneArgs = {
  name: string;
  table: string;
  parent: string;
};
type RelationManyArgs = {
  name: string;
  table: string;
  many: string[];
};
type FieldsRelationTableArgs = {
  table: string;
  junctionTable: string;
  relations: string[];
  hasLocale?: boolean;
};
type TemplateExportSchemaArgs = { enumTables: string[]; enumRelations: string[] };
