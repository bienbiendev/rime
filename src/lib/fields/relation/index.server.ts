import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import { capitalize } from '$lib/util/string.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { RelationFieldBuilder } from './index.js';

export const toSchema: ToSchema<RelationFieldBuilder<any>> = (field, parentPath) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}', { mode: 'json' })${suffix}`;
};

export const toType: ToType<RelationFieldBuilder<any>> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: RelationValue<${capitalize(field.raw.relationTo)}Doc>`;
};
