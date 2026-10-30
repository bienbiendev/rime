import type { DataType, FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { FormField } from '#lib/fields/types.js';
import { templateReferences } from './templates.server.js';
import { getSchemaColumnNames } from '../naming.server.js';

/** How each field `dataType` is spelled in drizzle. */
const COLUMN_EXPR: Record<DataType, (snake: string) => string> = {
  text: (snake) => `text('${snake}')`,
  boolean: (snake) => `integer('${snake}', { mode: 'boolean' })`,
  number: (snake) => `real('${snake}')`,
  timestamp: (snake) => `integer('${snake}', { mode: 'timestamp_ms' })`,
  json: (snake) => `text('${snake}', { mode: 'json' })`
};

/**
 * Renders a single Drizzle column definition for any leaf FormFieldBuilder, driven by the
 * field's own `dataType` (storage type) and `_references` (foreign key). A field column is
 * nullable and has no default, `NULL` being a value nobody wrote, unless the field says
 * `$notNull()`. A `.unique()` field gets no constraint either: `validateFields` checks it.
 *
 * @example
 * toSchemaColumn(text('title').required())     // "title: text('title')"
 * toSchemaColumn(slug('slug').unique())        // "slug: text('slug')"
 * toSchemaColumn(toggle('ok').$notNull({ default: false }))
 * // "ok: integer('ok', { mode: 'boolean' }).notNull().default(false)"
 */
export function toSchemaColumn(field: FormFieldBuilder<FormField>, parentPath?: string): string {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const { notNull } = field.get;
  const columnExpr = COLUMN_EXPR[field.dataType](snake);
  const referencesStr = field._references ? templateReferences(field._references) : '';
  const notNullStr = notNull ? `.notNull().default(${JSON.stringify(notNull.default)})` : '';
  return `${camel}: ${columnExpr}${referencesStr}${notNullStr}`;
}
