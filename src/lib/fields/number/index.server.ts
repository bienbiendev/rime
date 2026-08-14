import type { ToType } from '../index.server.js';
import type { NumberFieldBuilder } from './index.js';

export const toType: ToType<NumberFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: number`;
};
