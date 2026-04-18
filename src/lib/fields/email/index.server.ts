import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { EmailField } from './index.js';

export function toSchema(field: FormFieldBuilder<EmailField>, parentPath?: string) {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired({ unique: field.raw.unique, required: field.raw.required });
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}')${suffix}`;
}

export function toType(args: { name: string; required: boolean }) {
  return `${args.name}${args.required ? '' : '?'}: string`;
}
