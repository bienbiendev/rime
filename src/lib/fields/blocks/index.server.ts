import { toPascalCase } from '$lib/util/string.js';
import type { ToType } from '../index.server.js';
import type { BlocksBuilder } from './index.js';

export const toType: ToType<BlocksBuilder> = (field) => {
  const blockNames = field.raw.blocks.map((block) => `Block${toPascalCase(block.raw.name)}`);
  return `${field.name}: Array<${blockNames.join(' | ')}>,`;
};
