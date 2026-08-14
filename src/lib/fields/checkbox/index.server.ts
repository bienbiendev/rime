import type { ToType } from '../index.server.js';
import type { CheckboxFieldBuilder } from './index.js';

export const toType: ToType<CheckboxFieldBuilder> = (field) => {
  return `${field.raw.name}: boolean`;
};
