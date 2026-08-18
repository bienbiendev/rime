import type { ToType } from '../index.server.js';
import type { RadioFieldBuilder } from './index.js';

export const toType: ToType<RadioFieldBuilder> = (field) => {
  const optionsString = field.get.options.map((option) => `'${option.value}'`).join(' | ');
  return `${field.name}${field.get.required ? '' : '?'}: ${optionsString}`;
};
