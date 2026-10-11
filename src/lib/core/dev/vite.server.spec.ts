import path from 'node:path';
import { expect, it } from 'vitest';
import { isInConfigDir } from './vite.server.js';

it('matches a ./-prefixed config folder and not its generated sibling', () => {
  const file = path.resolve('src/cms/collections/pages.ts');
  expect(isInConfigDir(file, './src/cms')).toBe(true);
  expect(isInConfigDir(path.resolve('src/cms.generated/pages.ts'), './src/cms')).toBe(false);
});
