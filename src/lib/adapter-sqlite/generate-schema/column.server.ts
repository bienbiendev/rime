import type { DataType, FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { FormField } from '$lib/fields/types.js';
import { templateReferences, templateUniqueRequired } from './templates.server.js';
import { getSchemaColumnNames } from './util.server.js';

const COLUMN_EXPR: Record<DataType, (snake: string) => string> = {
  text: (snake) => `text('${snake}')`,
  boolean: (snake) => `integer('${snake}', { mode: 'boolean' })`,
  number: (snake) => `real('${snake}')`,
  timestamp: (snake) => `integer('${snake}', { mode: 'timestamp_ms' })`,
  json: (snake) => `text('${snake}', { mode: 'json' })`
};

/**
 * Resolves the `.default(...)` fallback used when a field is required but has
 * no usable value in `field.defaultValue` — SQLite needs a type-correct
 * DEFAULT to add a NOT NULL column via drizzle-kit migration on a table with
 * existing rows. Keyed by field type (not dataType) and reading
 * `field.raw.defaultValue` directly, exactly mirroring what each field's own
 * `toSchema` did before this refactor — kept here, not on the field builders,
 * since it's schema-generation-only and not part of a field's public API.
 */
const RESOLVE_DEFAULT: Record<string, (field: FormFieldBuilder<FormField>) => unknown> = {
  text: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  email: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  slug: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  combobox: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  radio: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  textarea: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : ''),
  time: (f) => (typeof f.raw.defaultValue === 'string' ? f.raw.defaultValue : '00:00'),
  checkbox: (f) => (f.raw as { defaultValue?: unknown }).defaultValue ?? false,
  toggle: (f) => (typeof f.raw.defaultValue === 'boolean' ? f.raw.defaultValue : false),
  number: (f) => (typeof f.raw.defaultValue === 'number' ? f.raw.defaultValue : 0),
  date: (f) => (f.raw.defaultValue instanceof Date ? f.raw.defaultValue.getTime() : 0),
  link: (f) => (typeof f.raw.defaultValue === 'object' ? f.raw.defaultValue : {}),
  richText: (f) => (typeof f.raw.defaultValue === 'object' ? f.raw.defaultValue : {}),
  relation: () => ({}),
  select: (f) => {
    const many = (f.raw as { many?: boolean }).many;
    const empty = many ? [] : '';
    return typeof f.raw.defaultValue === 'undefined' ? empty : f.raw.defaultValue;
  }
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
  // `unique` only exists on the field types that support it (text/email/slug);
  // reading it off the generic FormField base needs a narrow cast, same as
  // each field's own toSchema did today by typing against its concrete field.
  const { unique, required } = field.raw as { unique?: boolean; required?: boolean };
  // `dataType` is implemented by every leaf field builder but isn't declared
  // on the FormFieldBuilder base (see the comment there) — narrow cast here.
  const dataType = (field as unknown as { dataType: DataType }).dataType;
  const columnExpr = COLUMN_EXPR[dataType](snake);
  const referencesStr = field._references ? templateReferences(field._references) : '';
  const defaultValue = RESOLVE_DEFAULT[field.type]?.(field);
  const suffix = templateUniqueRequired({ unique, required }, defaultValue as any);
  return `${camel}: ${columnExpr}${referencesStr}${suffix}`;
}
