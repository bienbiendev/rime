import type { ToType } from '../index.server.js';
import type { SlugFieldBuilder } from './index.js';

export const toType: ToType<SlugFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: string`;
};
