import path from 'node:path';
import type { UserConfig } from 'vite';
import { expect, it } from 'vitest';
import { isInConfigDir, rime } from './vite.server.js';

it('matches a ./-prefixed config folder and not its generated sibling', () => {
  const file = path.resolve('src/cms/collections/pages.ts');
  expect(isInConfigDir(file, './src/cms')).toBe(true);
  expect(isInConfigDir(path.resolve('src/cms.generated/pages.ts'), './src/cms')).toBe(false);
});

it("ignores the project's storage/ only, not a folder named storage deeper in the tree", () => {
  const config = (rime().config as () => UserConfig)();
  const matchers = [config.server?.watch?.ignored ?? []].flat();
  // As the watcher reads them: a glob, or a function of the path
  const ignored = (file: string) =>
    matchers.some((matcher) =>
      typeof matcher === 'function'
        ? matcher(file)
        : typeof matcher === 'string'
          ? path.matchesGlob(file, matcher)
          : matcher.test(file)
    );

  expect(ignored(path.resolve('storage/sqlite/app.sqlite'))).toBe(true);
  expect(ignored(path.resolve('storage/uploads/medias/photo.jpg'))).toBe(true);
  expect(ignored(path.resolve('src/lib/server/storage/files.ts'))).toBe(false);
  expect(ignored(path.resolve('src/+rime/storage/settings.ts'))).toBe(false);
});
