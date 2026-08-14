import type { ToType } from '../index.server.js';
import type { DateFieldBuilder } from './index.ts';

export const toType: ToType<DateFieldBuilder> = (field) => {
  return `${field.name}${field.__required ? '' : '?'}: Date`;
};
