import type { DataType, FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { FormField } from '#lib/fields/types.js';
import { templateReferences, templateUniqueRequired } from './templates.server.js';
import { getSchemaColumnNames } from '../naming.server.js';

const COLUMN_EXPR: Record<DataType, (snake: string) => string> = {
  text: (snake) => `text('${snake}')`,
  boolean: (snake) => `integer('${snake}', { mode: 'boolean' })`,
  number: (snake) => `real('${snake}')`,
  timestamp: (snake) => `integer('${snake}', { mode: 'timestamp_ms' })`,
  json: (snake) => `text('${snake}', { mode: 'json' })`
};

/** Whether a value can be written as a column's DEFAULT, by the column's storage type. */
const FITS: Record<DataType, (value: unknown) => boolean> = {
  text: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  number: (value) => typeof value === 'number',
  timestamp: (value) => value instanceof Date,
  json: (value) => typeof value === 'object' && value !== null
};

/** The empty value of each storage type: what rows written before the column was added hold. */
const EMPTY: Record<DataType, unknown> = {
  text: '',
  boolean: false,
  number: 0,
  timestamp: new Date(0),
  json: {}
};

/** The field types whose empty value is not their storage type's. */
const EMPTY_BY_TYPE: Record<string, (field: FormFieldBuilder<FormField>) => unknown> = {
  time: () => '00:00',
  select: (field) => ((field.get as { many?: boolean }).many ? [] : '')
};

/**
 * The DEFAULT of a required column: the field's own `defaultValue` when the column can hold it,
 * else an empty value of the column's type. A function default is not a value and is skipped.
 *
 * ```ts
 * columnDefault(select('kind').options('a').required())          // ''
 * columnDefault(number('n').required().defaultValue(3))          // 3
 * columnDefault(checkbox('ok').required().defaultValue(() => 1)) // false
 * ```
 */
const columnDefault = (field: FormFieldBuilder<FormField>) => {
  const own = field.get.defaultValue;
  if (FITS[field.dataType](own)) return own;
  return EMPTY_BY_TYPE[field.type]?.(field) ?? EMPTY[field.dataType];
};

/**
 * Renders a single Drizzle column definition for any leaf FormFieldBuilder,
 * driven by the field's own `dataType` (storage type) and `_references`
 * (foreign key) — the adapter owns all Drizzle syntax, fields only declare
 * storage semantics via `dataType`.
 *
 * @example
 * // returns "title: text('title').notNull().default(\"\"),"
 * toSchemaColumn(text('title').required())
 */
export function toSchemaColumn(field: FormFieldBuilder<FormField>, parentPath?: string): string {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  // `unique` only exists on text, email and slug, so reading it off the generic FormField needs
  // a narrow cast.
  const { unique, required } = field.get as { unique?: boolean; required?: boolean };
  const columnExpr = COLUMN_EXPR[field.dataType](snake);
  const referencesStr = field._references ? templateReferences(field._references) : '';
  const suffix = templateUniqueRequired({ unique, required }, columnDefault(field) as any);
  return `${camel}: ${columnExpr}${referencesStr}${suffix}`;
}
