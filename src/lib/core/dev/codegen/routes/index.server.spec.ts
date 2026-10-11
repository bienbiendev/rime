import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PANEL_ROUTE } from '../../constants.server.js';
import { paramsModule } from './common.server.js';
import { matcherValues, writeAppLayoutServer } from './index.server.js';
import { routesMemo } from './util.server.js';

describe('writeAppLayoutServer', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rime-routes-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the app's own root layout server", () => {
    writeFileSync(join(dir, '+layout.server.ts'), 'export const load = () => ({ menu: [] });');
    expect(writeAppLayoutServer(dir)).toBe(false);
    expect(readFileSync(join(dir, '+layout.server.ts'), 'utf8')).toContain('menu');
  });

  it('counts a JavaScript root layout server', () => {
    writeFileSync(join(dir, '+layout.server.js'), 'export const load = () => ({});');
    expect(writeAppLayoutServer(dir)).toBe(false);
    expect(existsSync(join(dir, '+layout.server.ts'))).toBe(false);
  });

  it('writes a missing root layout server', () => {
    expect(writeAppLayoutServer(dir)).toBe(true);
    expect(readFileSync(join(dir, '+layout.server.ts'), 'utf8')).toContain('toPublicUser');
  });
});

describe('matcherValues', () => {
  const kebabs = { collection: ['pages'], area: [] };
  const localized = {
    localization: { locales: [{ code: 'fr' }, { code: 'en' }], default: 'fr' }
  } as any;

  it('adds the locale matcher for a config with locales', () => {
    expect(matcherValues(localized, kebabs)).toEqual({
      panel: [PANEL_ROUTE],
      collection: ['pages'],
      locale: ['fr', 'en']
    });
    expect(paramsModule(matcherValues(localized, kebabs))).toContain('locale: oneOf(["fr","en"])');
  });

  it('has no locale matcher without localization', () => {
    expect(matcherValues({} as any, kebabs)).toEqual({
      panel: [PANEL_ROUTE],
      collection: ['pages']
    });
  });

  it('rewrites the routes when the locales change', () => {
    expect(routesMemo(localized)).not.toBe(routesMemo({} as any));
  });
});
