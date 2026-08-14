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

// Single-call type guards for RESOLVE_DEFAULT below — calling
// f.__defaultValue itself has no reason to run twice per branch.
// `ensureObject` intentionally matches `typeof v === 'object'` including
// `null` (not `v !== null`), since that's what the pre-refactor per-field
// toSchema checks did — a field with no explicit default (constructor sets
// `defaultValue = null`) will keep `null`, not fall back to `{}`. Not
// touching that here, even though it looks like a latent bug.
const ensureString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const ensureNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const ensureBoolean = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const ensureDate = (v: unknown): Date | undefined => (v instanceof Date ? v : undefined);
const ensureObject = (v: unknown): object | undefined =>
  typeof v === 'object' ? (v as object) : undefined;

/**
 * Resolves the `.default(...)` fallback used when a field is required but has
 * no usable value in `field.defaultValue` — SQLite needs a type-correct
 * DEFAULT to add a NOT NULL column via drizzle-kit migration on a table with
 * existing rows. Keyed by field type (not dataType) and reading
 * `field.__defaultValue` directly, exactly mirroring what each field's own
 * `toSchema` did before this refactor — kept here, not on the field builders,
 * since it's schema-generation-only and not part of a field's public API.
 */
const RESOLVE_DEFAULT: Record<string, (field: FormFieldBuilder<FormField>) => unknown> = {
  text: (f) => ensureString(f.__defaultValue) ?? '',
  email: (f) => ensureString(f.__defaultValue) ?? '',
  slug: (f) => ensureString(f.__defaultValue) ?? '',
  combobox: (f) => ensureString(f.__defaultValue) ?? '',
  radio: (f) => ensureString(f.__defaultValue) ?? '',
  textarea: (f) => ensureString(f.__defaultValue) ?? '',
  time: (f) => ensureString(f.__defaultValue) ?? '00:00',
  checkbox: (f) => f.__defaultValue ?? false,
  toggle: (f) => ensureBoolean(f.__defaultValue) ?? false,
  number: (f) => ensureNumber(f.__defaultValue) ?? 0,
  date: (f) => ensureDate(f.__defaultValue)?.getTime() ?? 0,
  link: (f) => ensureObject(f.__defaultValue) ?? {},
  richText: (f) => ensureObject(f.__defaultValue) ?? {},
  relation: () => ({}),
  select: (f) => {
    const many = (f.raw as { many?: boolean }).many;
    const empty = many ? [] : '';
    const value = f.__defaultValue;
    return typeof value === 'undefined' ? empty : value;
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
