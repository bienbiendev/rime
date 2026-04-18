import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { DateFieldBuilder } from './index.ts';

export const toSchema: ToSchema<DateFieldBuilder> = (field, parentPath?: string) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.raw.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: integer('${snake}', { mode : 'timestamp_ms' })${suffix}`;
};

export const toType: ToType<DateFieldBuilder> = (field) => {
  return `${field.raw.name}${field.raw.required ? '' : '?'}: Date`;
};
