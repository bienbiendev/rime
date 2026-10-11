import { describe, expect, it } from 'vitest';
import { adapterHooksModule, importAdapterHooks } from './adapter-hooks.server.js';

describe('adapterHooksModule', () => {
  it("names rime's own sqlite hooks, or a package's hooks entry", () => {
    expect(adapterHooksModule('sqlite')).toBe('rimecms/adapter-sqlite/hooks');
    expect(adapterHooksModule('@acme/rime-postgres')).toBe('@acme/rime-postgres/hooks');
  });
});

describe('importAdapterHooks', () => {
  it("answers rime's own hooks from the source, whose module is the specifier asked for", async () => {
    const hooks = await importAdapterHooks('rimecms/adapter-sqlite/hooks');
    expect(hooks.module).toBe('rimecms/adapter-sqlite/hooks');
    expect(typeof hooks.clear).toBe('function');
  });

  it('rejects a module that does not import', async () => {
    await expect(importAdapterHooks('@acme/not-installed/hooks')).rejects.toThrow();
  });
});
