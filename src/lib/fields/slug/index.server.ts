import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { SlugFieldBuilder } from './index.js';

export const toSchema: ToSchema<SlugFieldBuilder> = (field, parentPath) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired({ unique: field.raw.unique, required: field.raw.required });
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}')${suffix}`;
};

export const toType: ToType<SlugFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: string`;
};
