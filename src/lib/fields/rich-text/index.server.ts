import type { ToType } from '../index.server.js';
import type { RichTextFieldBuilder } from './index.js';

export const toType: ToType<RichTextFieldBuilder> = (field) => {
  return `${field.name}${field.raw.required ? '' : '?'}: import('@tiptap/core').JSONContent`;
};
