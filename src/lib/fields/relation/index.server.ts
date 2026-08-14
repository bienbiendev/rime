import { capitalize } from '$lib/util/string.js';
import type { ToType } from '../index.server.js';
import type { RelationFieldBuilder } from './index.js';

export const toType: ToType<RelationFieldBuilder<any>> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: RelationValue<${capitalize(field.raw.relationTo)}Doc>`;
};
