import { describe, expect, it } from 'vitest';
import { cache } from './cache/index.js';
import { configurePlugins } from './configure.js';

describe('configurePlugins', () => {
  it('lets a plugin the config adds replace the default plugin of the same name', () => {
    const own = cache({ isEnabled: () => false });
    const { plugins } = configurePlugins({ plugins: [own] } as any) as any;
    const caches = plugins.filter((plugin: any) => plugin.name === 'cache');
    expect(caches).toEqual([own]);
  });
});
