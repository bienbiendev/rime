import type { Config } from '#lib/core/config/types.js';
import { describe, expect, it, vi } from 'vitest';
import { configureCors } from './configure.server.js';

// A SITE_URL written with a trailing slash
vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com/' }));

describe('configureCors', () => {
  it("trusts the site's own origin, without its trailing slash", () => {
    expect(configureCors({} as Config).$trustedOrigins).toEqual(['https://site.com']);
  });

  it("adds the authored origins to the site's own", () => {
    const config = configureCors({ $trustedOrigins: ['https://app.example.com'] } as Config);
    expect(config.$trustedOrigins).toEqual(['https://site.com', 'https://app.example.com']);
  });

  it("lists the site's origin once when the author names it too", () => {
    const config = configureCors({ $trustedOrigins: ['https://site.com'] } as Config);
    expect(config.$trustedOrigins).toEqual(['https://site.com']);
  });
});
