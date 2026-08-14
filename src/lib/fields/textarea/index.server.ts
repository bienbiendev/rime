import type { ToType } from '../index.server.js';
import type { TextAreaFieldBuilder } from './index.js';

export const toType: ToType<TextAreaFieldBuilder> = (field) => {
  return `${field.name}${field.__required ? '' : '?'}: string`;
};
