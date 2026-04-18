import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { RadioFieldBuilder } from './index.js';

export const toSchema: ToSchema<RadioFieldBuilder> = (field, parentPath?: string) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.raw.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}')${suffix}`;
};

export const toType: ToType<RadioFieldBuilder> = (field) => {
  const optionsString = field.raw.options.map((option) => `'${option.value}'`).join(' | ');
  return `${field.raw.name}${field.raw.required ? '' : '?'}: ${optionsString}`;
};
