import type { ToType } from '../index.server.js';
import type { DateFieldBuilder } from './index.ts';

export const toType: ToType<DateFieldBuilder> = (field) => {
  return `${field.raw.name}${field.raw.required ? '' : '?'}: Date`;
};
