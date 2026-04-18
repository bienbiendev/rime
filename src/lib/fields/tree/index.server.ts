import { toPascalCase } from '$lib/util/string.js';
import type { TreeBuilder } from './index.js';
import type { ToType } from '../index.server.js';

export const toType: ToType<TreeBuilder> = (field) => {
  return `${field.name}: Array<Tree${toPascalCase(field.name)}>,`;
};
