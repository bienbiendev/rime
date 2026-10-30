import type { Config } from '#lib/core/config/types.js';
import { expect, it } from 'vitest';
import { templateRegister } from './templates.server.js';

// A versioned collection and a versioned area, as the built config holds them: each versions table
// is a collection of its own, left out of the generated types.
const config = {
  collections: [
    { slug: 'news', _versions: { slug: '$news__versions' } },
    { slug: '$news__versions', _generateTypes: false },
    { slug: '$settings__versions', _generateTypes: false }
  ],
  areas: [{ slug: 'settings', _versions: { slug: '$settings__versions' } }]
} as unknown as Config;

it("registers a versions table under its owner's doc type, a collection's or an area's", () => {
  const register = templateRegister(config);

  expect(register).toContain("'news': NewsDoc;");
  expect(register).toContain("'$news__versions': NewsDoc;");
  expect(register).toContain("'$settings__versions': SettingsDoc;");
  expect(register).toContain("'settings': SettingsDoc");
});
