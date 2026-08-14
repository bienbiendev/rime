import type { ToType } from '../index.server.js';
import type { ToggleFieldBuilder } from './index.js';

export const toType: ToType<ToggleFieldBuilder> = (field) => {
  return `${field.name}${field.__required ? '?' : ''}: boolean`;
};
