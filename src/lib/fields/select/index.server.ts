import type { ToType } from '../index.server.js';
import type { SelectFieldBuilder } from './index.js';

export const toType: ToType<SelectFieldBuilder> = (field) => {
  const optionsJoinedType = field.raw.options.map((o) => `'${o.value}'`).join(' | ');
  return `${field.name}${field.__required ? '' : '?'}: (${optionsJoinedType})${field.raw.many ? '[]' : ''}`;
};
