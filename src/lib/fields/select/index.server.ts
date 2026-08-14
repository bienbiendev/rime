import type { ToType } from '../index.server.js';
import type { SelectFieldBuilder } from './index.js';

export const toType: ToType<SelectFieldBuilder> = (field) => {
  const optionsJoinedType = field.raw.options.map((o) => `'${o.value}'`).join(' | ');
  return `${field.raw.name}${field.raw.required ? '' : '?'}: (${optionsJoinedType})${field.raw.many ? '[]' : ''}`;
};
