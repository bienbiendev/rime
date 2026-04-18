import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import type { RichTextFieldBuilder } from './index.js';
import type { ToSchema, ToType } from '../index.server.js';

export const toSchema: ToSchema<RichTextFieldBuilder> = (field, parentPath) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}')${suffix}`;
};

export const toType: ToType<RichTextFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: import('@tiptap/core').JSONContent`;
};
