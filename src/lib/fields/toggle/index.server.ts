import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { ToggleFieldBuilder } from './index.js';

export const toSchema: ToSchema<ToggleFieldBuilder> = (field, parentPath) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: integer('${snake}', { mode: 'boolean' })${suffix}`;
};

export const toType: ToType<ToggleFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '?' : ''}: boolean`;
};
