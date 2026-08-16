import type { ToType } from '../index.server.js';
import type { TimeFieldBuilder } from './index.js';

export const toType: ToType<TimeFieldBuilder> = (field) => {
  return `${field.name}${!field.get.required ? '?' : ''}: string`;
};
