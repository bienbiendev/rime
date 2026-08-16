import type { ToType } from '../index.server.js';
import type { SelectFieldBuilder } from './index.js';

export const toType: ToType<SelectFieldBuilder> = (field) => {
  const optionsJoinedType = field.get.options.map((o) => `'${o.value}'`).join(' | ');
  return `${field.name}${field.get.required ? '' : '?'}: (${optionsJoinedType})${field.get.many ? '[]' : ''}`;
};
