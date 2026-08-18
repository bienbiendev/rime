import { toPascalCase } from '$lib/util/string.js';
import type { ToType } from '../index.server.js';
import type { BlocksBuilder } from './index.js';

export const toType: ToType<BlocksBuilder> = (field) => {
  const blockNames = field.get.blocks.map((block) => `Block${toPascalCase(block.name)}`);
  return `${field.name}: Array<${blockNames.join(' | ')}>,`;
};
