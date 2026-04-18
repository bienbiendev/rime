import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { SelectFieldBuilder } from './index.js';
import type { ToSchema, ToType } from '../index.server.js';

export const toSchema: ToSchema<SelectFieldBuilder> = (field, parentPath?: string) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.raw.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  if (field.raw.many) {
    return `${camel}: text('${snake}', { mode: 'json' })${suffix}`;
  } else {
    return `${camel}: text('${snake}')${suffix}`;
  }
};

export const toType: ToType<SelectFieldBuilder> = (field) => {
  const optionsJoinedType = field.raw.options.map((o) => `'${o.value}'`).join(' | ');
  return `${field.raw.name}${field.raw.required ? '' : '?'}: (${optionsJoinedType})${field.raw.many ? '[]' : ''}`;
};
