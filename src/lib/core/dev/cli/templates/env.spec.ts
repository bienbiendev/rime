import { describe, expect, it, vi } from 'vitest';

vi.mock('../../constants.server.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../constants.server.js')>()),
  CONFIG_DIR: 'src/+rime',
  PANEL_ROUTE: 'panel'
}));

const { devEnv, missingEnv, productionEnv, renderEnv } = await import('./env.js');
const { missingEnvVars } = await import('./init.js');

describe('.env templates', () => {
  it('appends the missing blocks with their comment', () => {
    const missing = renderEnv(missingEnv('SITE_URL=http://example.com\n', devEnv()));
    expect(missing).not.toContain('SITE_URL=');
    expect(missing).toContain('RIME_CACHE_ENABLED=false');
    expect(missing).toMatch(/both regenerate the panel routes.\nRIME_PANEL_ROUTE=/);
  });

  it('counts a commented-out variable as set', () => {
    const missing = missingEnv('SMTP_USER=me@site.org\n# SMTP_HOST=mail.site.org\n', devEnv());
    const keys = missing.flatMap((block) => Object.keys(block.values));
    // SMTP_USER is set and SMTP_HOST commented out: only the other two are asked for
    expect(keys.filter((key) => key.includes('SMTP'))).toEqual(['# SMTP_PASSWORD', '# SMTP_PORT']);
  });

  it('writes only variables src/env.ts declares, besides the adapter-node ones', () => {
    // Read by the CLI or by adapter-node, not through src/env.ts
    const outside = [
      'RIME_CONFIG_DIR',
      'PROTOCOL_HEADER',
      'HOST_HEADER',
      'PORT',
      'HOST',
      'BODY_SIZE_LIMIT'
    ];
    const declared = missingEnvVars('');
    for (const blocks of [devEnv(), productionEnv()]) {
      for (const key of blocks.flatMap((block) => Object.keys(block.values))) {
        const name = key.replace(/^# /, '');
        expect(outside.includes(name) || declared.includes(name)).toBe(true);
      }
    }
  });
});
