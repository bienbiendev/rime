import type { ToType } from '../index.server.js';
import type { ComboBoxFieldBuilder } from './index.js';

export const toType: ToType<ComboBoxFieldBuilder> = (field) => {
  const optionsJoinedType = field.get.options.map((o) => `'${o.value}'`).join(' | ');
  return `${field.name}${field.get.required ? '' : '?'}: ${optionsJoinedType}`;
};
