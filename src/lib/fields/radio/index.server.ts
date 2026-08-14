import type { ToType } from '../index.server.js';
import type { RadioFieldBuilder } from './index.js';

export const toType: ToType<RadioFieldBuilder> = (field) => {
  const optionsString = field.raw.options.map((option) => `'${option.value}'`).join(' | ');
  return `${field.name}${field.__required ? '' : '?'}: ${optionsString}`;
};
