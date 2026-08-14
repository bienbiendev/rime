import type { ToType } from '../index.server.js';
import type { RadioFieldBuilder } from './index.js';

export const toType: ToType<RadioFieldBuilder> = (field) => {
  const optionsString = field.raw.options.map((option) => `'${option.value}'`).join(' | ');
  return `${field.raw.name}${field.raw.required ? '' : '?'}: ${optionsString}`;
};
