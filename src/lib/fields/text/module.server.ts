import type { ToType } from '../index.server.js';
import type { TextFieldBuilder } from './index.js';

export const toType: ToType<TextFieldBuilder> = (field) => {
  return `${field.name}${field.get.required ? '' : '?'}: string`;
};
